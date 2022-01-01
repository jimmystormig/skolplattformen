import {
    Api, AuthTicket, CalendarItem, Classmate, CookieManager, EtjanstChild, Fetch, Fetcher, FetcherOptions, LoginStatusChecker, MenuItem, NewsItem, Notification, ScheduleItem, SchoolContact, Skola24Child, Teacher, TimetableEntry, User, wrap, SSOSystem
  } from '@skolplattformen/api'

import EventEmitter from "events";
import { DateTime } from 'luxon';
import { checkStatus, DummyStatusChecker } from './loginStatus'
import { scrapeChildren } from './parse/children';
import { scrapeNews, scrapeNewsDetail } from './parse/news';
import { extractAlingsasSamlAuthRequestForm, extractAlingsasSamlAuthResponseForm, extractSkola24FrameSource, extractSkola24LoginNovaSsoUrl } from './parse/parsers';
import { parseSchools, parseChildren } from './parse/skola24';
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
    let response = await this.fetch('current-user', routes.arena);

    if (!response.ok) {
      throw new Error(
        `Server Error [${response.status}] [${response.statusText}] [${routes.arena}]`
      )
    }

    const body = await response.text();
    return await scrapeChildren(body);
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
    let response = await this.fetch('current-user', routes.arenaNews(item.id));

    if (!response.ok) {
      throw new Error(
        `Server Error [${response.status}] [${response.statusText}] [${routes.arena}]`
      )
    }

    const body = await response.text();
    return await scrapeNewsDetail(body);
  }

  async getMenu(child: EtjanstChild): Promise<MenuItem[]> {
    return [];
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

    const absenceResponse = await this.fetch('skola24-roles', routes.skola24Absence, { 
      body: "null",
      method: "POST",
      headers: {
        "referrer": "https://web.skola24.se/portal/start/overview/dashboard",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "mode": "cors",
        "credentials": "include",
        "accept": "application/json, text/javascript, */*; q=0.01",
        "accept-language": "sv,en;q=0.9,en-US;q=0.8",
        "cache-control": "no-cache",
        "content-type": "application/json",
        "pragma": "no-cache",
        "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"96\", \"Google Chrome\";v=\"96\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest",
        "x-scope": "65340ebb-fd0e-411d-976b-d251d76679b7"
      }
    });
    const absence = await absenceResponse.json();
    const schools = parseSchools(absence);

    const studentsResponse = await this.fetch('skola24-students', routes.skola24Students, {
      method: 'POST',
      body: JSON.stringify({ schools: schools.map(school => school.id) }),
      headers: {
        "referrer": "https://web.skola24.se/portal/start/overview/dashboard",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "mode": "cors",
        "credentials": "include",
        "accept": "application/json, text/javascript, */*; q=0.01",
        "accept-language": "sv,en;q=0.9,en-US;q=0.8",
        "cache-control": "no-cache",
        "content-type": "application/json",
        "pragma": "no-cache",
        "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"96\", \"Google Chrome\";v=\"96\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest",
        "x-scope": "65340ebb-fd0e-411d-976b-d251d76679b7"
      }
    });
    const students = await studentsResponse.json();
    return parseChildren(students);
  }

  async getTimetable(child: Skola24Child, week: number, year: number, lang: string): Promise<TimetableEntry[]> {
    // Schema
    return [];
  }

  async logout(): Promise<void> {
    this.isLoggedIn = false
    this.personalNumber = undefined
    this.cookieManager.clearAll()
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
}