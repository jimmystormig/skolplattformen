import {
    Api, AuthTicket, CalendarItem, Classmate, CookieManager, EtjanstChild, Fetch, Fetcher, FetcherOptions, LoginStatusChecker, MenuItem, NewsItem, Notification, ScheduleItem, SchoolContact, Skola24Child, Teacher, TimetableEntry, User, wrap
  } from '@skolplattformen/api'

import EventEmitter from "events";
import { DateTime } from 'luxon';
import { checkStatus, DummyStatusChecker } from './loginStatus'
import { scrapeChildren } from './parse/children';
import { scrapeNews, scrapeNewsDetail } from './parse/news';
import { scrapeUser } from './parse/user';
import * as routes from './routes'
export class ApiArena extends EventEmitter implements Api {
  private fetch: Fetcher
  private realFetcher: Fetcher
  private cookieManager: CookieManager
  private personalNumber?: string
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
    const bankIdAuthUrl = routes.bankIdAuthUrl(bankIDBaseUrl)
    const ticketResponse = await this.fetch('auth-ticket', bankIdAuthUrl, {
      redirect: 'follow',
      method: 'POST',
      body: "ssn=" + personalNumber,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

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
    return [];
  }

  async getTimetable(child: Skola24Child, week: number, year: number, lang: string): Promise<TimetableEntry[]> {
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