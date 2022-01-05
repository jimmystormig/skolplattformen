import {
    Api, AuthTicket, CalendarItem, Classmate, CookieManager, EtjanstChild, Fetch, Fetcher, FetcherOptions, LoginStatusChecker, MenuItem, NewsItem, Notification, ScheduleItem, SchoolContact, Skola24Child, Teacher, TimetableEntry, User, wrap, SSOSystem
  } from '@skolplattformen/api'

import EventEmitter from "events";
import { DateTime } from 'luxon';
import { checkStatus, DummyStatusChecker } from './loginStatus'
// import { scrapeChildren } from './parse/children';
import { scrapeNews, scrapeNewsDetail } from './parse/news';
import { extractAlingsasSamlAuthRequestForm, extractAlingsasSamlAuthResponseForm, extractSkola24FrameSource, extractSkola24LoginNovaSsoUrl } from './parse/parsers';
import { parseTimetable } from './parse/skola24';
import { scrapeMenus } from './parse/skolmaten';
import { scrapeUser } from './parse/user';
import * as routes from './routes'

interface SSOSystems {
  [name: string]: boolean | undefined
}

export class ApiArena extends EventEmitter implements Api {
  private fetch: Fetcher
  private realFetcher: Fetcher
  private cookieManager: CookieManager
  private personalNumber?: string
  private authorizedSystems: SSOSystems = {}
  isFake = false;
  isLoggedIn = false;

  constructor(
    fetch: Fetch,
    cookieManager: CookieManager,
    options?: FetcherOptions
  ) {
    super()
    this.fetch = wrap(fetch, options)
    this.realFetcher = this.fetch
    this.cookieManager = cookieManager
  }

  public replaceFetcher(fetcher: Fetcher) {
    this.fetch = fetcher
  }

  getPersonalNumber(): string | undefined {
    return this.personalNumber
  }

  public async login(personalNumber?: string): Promise<LoginStatusChecker> {
    if (personalNumber !== undefined && personalNumber.endsWith('1212121212'))
      return this.fakeMode()

    this.isFake = false

    console.log('initiating login to Arena')

    // TODO Get https://arena.alingsas.se and check if not redirected -> already logged in
    const arenaResponse = await this.fetch('arena', routes.arena);

    const arenaResponseUrl = (arenaResponse as any).url as string;

    if (arenaResponseUrl.startsWith(routes.arena)) {
        // already logged in!
        const emitter = new DummyStatusChecker()
        setTimeout(() => {
          this.isLoggedIn = true
          emitter.emit('OK')
          this.emit('login')
        }, 50)
        return emitter as LoginStatusChecker;
    }

    // Was redirected to something like https://idp1.alingsas.se/wa/auth?authmech=Inloggning

    const arenaRedirectBaseUrl = routes.getBaseUrl(arenaResponseUrl);
    const loginBankIDLandingPageResponse = await this.fetch('loginpage', routes.loginBankIDLandingPage(arenaRedirectBaseUrl))

    // Was redirected to something like https://mNN-mg-local.idp.funktionstjanster.se/samlv2/idp/sign_in/337

    const bankIDBaseUrl = routes.getBaseUrl((loginBankIDLandingPageResponse as any).url);

    // Login with BankID on another device
    const bankIdAuthUrl = routes.bankIdOtherDeviceAuthUrl(bankIDBaseUrl);
    const ticketResponse = await this.fetch('auth-ticket-other', bankIdAuthUrl, {
      redirect: 'follow',
      method: 'POST',
      body: "ssn=" + personalNumber,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!ticketResponse.ok) {
      throw new Error(
        `Server Error [${ticketResponse.status}] [${ticketResponse.statusText}] [${bankIdAuthUrl}]`
      )
    }

    const status = checkStatus(this.fetch, bankIDBaseUrl)
    status.on('OK', async () => {
      this.isLoggedIn = true
      this.personalNumber = personalNumber
      this.emit('login')
    })
    status.on('ERROR', () => {
      this.personalNumber = undefined
    })

    return status
  }

  async setSessionCookie(sessionCookie: string): Promise<void> {
    this.cookieManager.setCookieString(sessionCookie, routes.arena)

    const user = await this.getUser()
    if (!user.isAuthenticated) {
      throw new Error('Session cookie is expired')
    }

    this.isLoggedIn = true
    this.emit('login')
  }

  async getSessionHeaders(url: string): Promise<{ [index: string]: string; }> {
    const cookie = await this.cookieManager.getCookieString(url)
    return {
        cookie,
    }
  }

  async getUser(): Promise<User> {
    let userPageResponse = await this.fetch('current-user', routes.currentUser);
    if (userPageResponse.status !== 200) {
      return { isAuthenticated: false }
    }

    if((userPageResponse as any).url !== routes.currentUser) {
      // TODO This is ugly, save the session cookie name SSESSxxx on login insted
      // Try again, cookie named SSES was probably missing
      userPageResponse = await this.fetch('current-user', routes.currentUser);
      if(userPageResponse.status !== 200 || (userPageResponse as any).url !== routes.currentUser) {
        // Give up
        return { isAuthenticated: false }
      }
    }

    var body = await userPageResponse.text();
    return scrapeUser(body);
  }

  async getChildren(): Promise<EtjanstChild[]> {
    /*
    let response = await this.fetch('current-user', routes.arena);

    if (!response.ok) {
      throw new Error(
        `Server Error [${response.status}] [${response.statusText}] [${routes.arena}]`
      )
    }

    const body = await response.text();
    return await scrapeChildren(body);
    */
   const skola24Children = await this.getSkola24Children();
   return skola24Children.map(child => {
     return {
       id: child.personGuid as string,
       name: `${child.firstName} ${child.lastName}`,
       schoolId: child.schoolID,
       sdsId: ''
     }
   });
  }

  async getCalendar(child: EtjanstChild): Promise<CalendarItem[]> {
    return [];
  }

  async getClassmates(child: EtjanstChild): Promise<Classmate[]> {
    return [];
  }

  async getNews(child: EtjanstChild): Promise<NewsItem[]> {
    let response = await this.fetch('current-user', routes.arena);

    if (!response.ok) {
      throw new Error(
        `Server Error [${response.status}] [${response.statusText}] [${routes.arena}]`
      )
    }

    const body = await response.text();
    return await scrapeNews(body, child);
  }

  async getNewsDetails(child: EtjanstChild, item: NewsItem): Promise<any> {
    // TODO Make news marked as read

    let response = await this.fetch('current-user', routes.arenaNews(item.id));

    if (!response.ok) {
      throw new Error(
        `Server Error [${response.status}] [${response.statusText}] [${routes.arena}]`
      )
    }

    const body = await response.text();
    return await scrapeNewsDetail(body, item);
  }

  async getMenu(child: EtjanstChild): Promise<MenuItem[]> {
    let schoolId = child.schoolId as string;

    switch (schoolId) {
      case 'Stadsskogenskolan':
        schoolId = 'aktivitetshuset-stadsskogen-skola';
        break;
      case 'Noltorpsskolan 1':
      case 'Noltorpsskolan 2':
        schoolId = 'noltorpsskolan';
        break;
      default:
        schoolId = schoolId.toLowerCase().replace(/ /g, '-').replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');
        break;
    }

    const url = routes.skolmaten(schoolId as string);
    const response = await this.fetch('skolmaten', url);

    if(response.status === 404) {
      return [];
    }

    const responseText = await response.text();
    return scrapeMenus(responseText);
  }

  async getNotifications(child: EtjanstChild): Promise<Notification[]> {
    return [];
  }

  async getTeachers(child: EtjanstChild): Promise<Teacher[]> {
    return [];
  }

  async getSchedule(child: EtjanstChild, from: DateTime, to: DateTime): Promise<ScheduleItem[]> {
    return [];
  }

  async getSchoolContacts(child: EtjanstChild): Promise<SchoolContact[]> {
    return [];
  }

  async getSkola24Children(): Promise<Skola24Child[]> {
    return await this.getSkola24Timetables();
  }
  
  async getTimetable(child: Skola24Child, week: number, year: number, lang: string): Promise<TimetableEntry[]> {
    const childrenTimetables = await this.getSkola24Timetables();
    const timetableForChild = childrenTimetables.find((timetable: any) => timetable.personGuid === child.personGuid);
    if(!timetableForChild) {
      throw new Error(`Could not find timetable for child ${child.firstName} ${child.lastName}`);
    }

    const timetableKeyResponse = await this.fetch('skola24-timetable-key', routes.skola24TimetableKey, {
      method: 'POST',
      body: "null",
      "headers": {
        "x-scope": "8a22163c-8662-4535-9050-bc5e1923df48",
        "referrer": "https://web.skola24.se/portal/start/timetable/timetable-viewer/alingsas-sso.skola24.se/",
        ...this.skola24CommonHeaders
      },
    });
    const timetableData = await timetableKeyResponse.json();
    const timetableKey = timetableData.data.key;

    const timetableResponse = await this.fetch('skola24-timetable', routes.skola24Timetable, {
      method: 'POST',
      body: JSON.stringify({
        renderKey: timetableKey,
        host:routes.skola24Host,
        unitGuid: timetableForChild.unitGuid,
        startDate:null,
        endDate: null,
        scheduleDay: 0,
        blackAndWhite: false,
        width: 1000,
        height: 550,
        selectionType: 5,
        selection: timetableForChild.personGuid,
        showHeader: false,
        periodText: "",
        week: week,
        year: year,
        privateFreeTextMode: null,
        privateSelectionMode: true,
        customerKey: ""
      }),
      "headers": {
        "referrer": "https://web.skola24.se/portal/start/timetable/timetable-viewer/alingsas-sso.skola24.se/",
        "x-scope": "8a22163c-8662-4535-9050-bc5e1923df48",
        ...this.skola24CommonHeaders
      },
    });

    const timetable = await timetableResponse.json();
    return parseTimetable(timetable, year, week);
  }

  async logout(): Promise<void> {
    this.isLoggedIn = false
    this.personalNumber = undefined
    this.cookieManager.clearAll()
    this.authorizedSystems = {}
    this.emit('logout')
  }

  private async fakeMode(): Promise<LoginStatusChecker> {
    this.isFake = true

    setTimeout(() => {
      this.isLoggedIn = true
      this.emit('login')
    }, 50)

    const emitter = new DummyStatusChecker()
    emitter.token = 'fake'
    return emitter
  }

  private async authenticateWithSkola24(): Promise<void> {
    const targetSystem = 'Skola24';
    if (this.authorizedSystems[targetSystem]) {
      return;
    }

    const skola24Response = await this.fetch('skola24', routes.skola24);
    const skola24ResponseText = await skola24Response.text();
    const ssoLoginUrl = await extractSkola24FrameSource(skola24ResponseText);
    const skola24LoginResponse = await this.fetch('skola24-login', (skola24Response as any).url + ssoLoginUrl);
    const skola24LoginResponseText = await skola24LoginResponse.text();
    const skola24LoginNovaSsoUrl = extractSkola24LoginNovaSsoUrl(skola24LoginResponseText)
    const skola24LoginNovaSsoResponse = await this.fetch('skola24-login-nova-sso', skola24LoginNovaSsoUrl as string);
    const skola24LoginNovaSsoResponseText = await skola24LoginNovaSsoResponse.text();
    const alingsasSamlAuthForm = extractAlingsasSamlAuthRequestForm(skola24LoginNovaSsoResponseText);
    const alingsasSamlAuthRequestResponse = await this.fetch('alingsas-saml-auth', alingsasSamlAuthForm.action, {
      redirect: 'follow',
      method: 'POST',
      body: "SAMLRequest=" + encodeURIComponent(alingsasSamlAuthForm.samlRequest),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://service-sso1.novasoftware.se/',
        'Connection': 'keep-alive'
      },
    });
    const alingsasSamlAuthRequestResponseText = await alingsasSamlAuthRequestResponse.text();
    const alingsasSamlAuthResponseForm = extractAlingsasSamlAuthResponseForm(alingsasSamlAuthRequestResponseText)
    const noveSsoSamlResponseResponse = await this.fetch('nova-saml-auth', alingsasSamlAuthResponseForm.action, {
      redirect: 'follow',
      method: 'POST',
      body: `SAMLResponse=${encodeURIComponent(alingsasSamlAuthResponseForm.samlResponse)}&RelayState=${encodeURIComponent(alingsasSamlAuthResponseForm.relayState)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://idp2.alingsas.se/',
        'Connection': 'keep-alive'
      },
    });

    // TODO Check noveSsoSamlResponseResponse

    this.authorizedSystems[targetSystem] = true
  }

  private async getSkola24Timetables(){
    const getSkola24ChildrenTimetables = async () => {
      const timetablesResponse = await this.fetch('skola24-timetables', routes.skola24Timetables, {
        method: 'POST',
        body: '{"getPersonalTimetablesRequest":{"hostName":"' + routes.skola24Host + '"}}',
        "headers": {
          "referrer": "https://web.skola24.se/portal/start/timetable/timetable-viewer",
          "x-scope": "8a22163c-8662-4535-9050-bc5e1923df48",
          ...this.skola24CommonHeaders
        },
      });
      const timetables = await timetablesResponse.json();
      const childrenTimetables = timetables.data.getPersonalTimetablesResponse.childrenTimetables;
      return childrenTimetables ? childrenTimetables : [];
    }

    let childrenTimetables = await getSkola24ChildrenTimetables();
    if(childrenTimetables.length === 0) {
      // No timetables found, probably not logged in to Skola24 -> Login and try again
      await this.authenticateWithSkola24();
      childrenTimetables = await getSkola24ChildrenTimetables();
    }
    return childrenTimetables;
  }

  private skola24CommonHeaders = {
    "accept": "application/json, text/javascript, */*; q=0.01",
    "accept-language": "sv,en;q=0.9,en-US;q=0.8",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "pragma": "no-cache",
    "x-requested-with": "XMLHttpRequest",
    "mode": "cors",
    "credentials": "include",
    "referrerPolicy": "strict-origin-when-cross-origin",
  }
}