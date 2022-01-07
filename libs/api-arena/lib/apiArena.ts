import {
  Api,
  CalendarItem,
  Classmate,
  CookieManager,
  EtjanstChild,
  Fetch,
  Fetcher,
  FetcherOptions,
  LoginStatusChecker,
  MenuItem,
  NewsItem,
  Notification,
  ScheduleItem,
  SchoolContact,
  Skola24Child,
  Teacher,
  TimetableEntry,
  User,
  wrap,
} from '@skolplattformen/api'

import EventEmitter from 'events'
import { DateTime } from 'luxon'
import { DummyStatusChecker } from './dummyStatusChecker'
import { getArenaAsCustodianUrl } from './parse/arena'
import { scrapeNews, scrapeNewsDetail } from './parse/news'
import { scrapeMenus } from './parse/skolmaten'
import {
  scrapeChildUrl,
  scrapeClassPeople,
  scrapeClassUrls,
  scrapeNotifications,
  scrapeNotificationsGuardianId,
} from './parse/unikum'
import * as routes from './routes'
import { ArenaService } from './service/arena.service'
import { CommonService } from './service/common.service'
import { Skola24Service } from './service/skola24.service'

interface SSOSystems {
  [name: string]: boolean | undefined
}

export class ApiArena extends EventEmitter implements Api {
  private fetch: Fetcher
  private cookieManager: CookieManager
  private personalNumber?: string
  private arenaService: ArenaService
  private skola24Service: Skola24Service
  isFake = false
  isLoggedIn = false

  constructor(
    fetch: Fetch,
    cookieManager: CookieManager,
    options?: FetcherOptions
  ) {
    super()
    this.fetch = wrap(fetch, options)
    this.cookieManager = cookieManager
    this.arenaService = new ArenaService(this.fetch, this.log)
    this.skola24Service = new Skola24Service(this.fetch, this.log)
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

    const status = await this.arenaService.authenticate(personalNumber)

    status.on('OK', async () => {
      this.isLoggedIn = true
      this.personalNumber = personalNumber

      await this.skola24Service.authenticate()

      this.log('[Unikum]', 'Authenticating...')
      await this.authenticateWithUnikum()

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

  async getSessionHeaders(url: string): Promise<{ [index: string]: string }> {
    const cookie = await this.cookieManager.getCookieString(url)
    return {
      cookie,
    }
  }

  async getUser(): Promise<User> {
    return this.arenaService.getUser()
  }

  async getChildren(): Promise<EtjanstChild[]> {
    const skola24Children = await this.getSkola24Children()
    return skola24Children.map((child) => {
      return {
        id: child.personGuid as string,
        name: `${child.firstName} ${child.lastName}`,
        schoolId: child.schoolID,
        sdsId: '',
      }
    })
  }

  async getCalendar(child: EtjanstChild): Promise<CalendarItem[]> {
    // TODO Is there any calendar in Arena?
    return []
  }

  async getClassmates(child: EtjanstChild): Promise<Classmate[]> {
    return await (
      await this.getClassPeople(child, 'elever')
    ).map((classmate) => {
      return {
        firstname: classmate.firstname,
        lastname: classmate.lastname,
        className: classmate.className,
        guardians: [],
        sisId: '',
      }
    })
  }

  async getNews(child: EtjanstChild): Promise<NewsItem[]> {
    let response = await this.fetch('current-user', routes.arena)

    if (!response.ok) {
      throw new Error(
        `Server Error [${response.status}] [${response.statusText}] [${routes.arena}]`
      )
    }

    const baseUrl = routes.getBaseUrl((response as any).url)
    let body = await response.text()

    // Special case when user is employed in Alingsås
    const custodianUrl = getArenaAsCustodianUrl(body, baseUrl)
    if (custodianUrl) {
      let custodianResponse = await this.fetch(
        'current-user-custodian',
        custodianUrl
      )
      body = await custodianResponse.text()
    }

    const news = await scrapeNews(body, child)

    const details = news.map((n) => this.fetchNewsDetails(n))
    await Promise.all(details)

    return news
  }

  async getNewsDetails(child: EtjanstChild, item: NewsItem): Promise<any> {
    return { ...item }
  }

  async getMenu(child: EtjanstChild): Promise<MenuItem[]> {
    let schoolId = child.schoolId as string

    switch (schoolId) {
      case 'Stadsskogenskolan':
        schoolId = 'aktivitetshuset-stadsskogen-skola'
        break
      case 'Noltorpsskolan 1':
      case 'Noltorpsskolan 2':
        schoolId = 'noltorpsskolan'
        break
      default:
        schoolId = schoolId
          .toLowerCase()
          .replace(/ /g, '-')
          .replace(/å/g, 'a')
          .replace(/ä/g, 'a')
          .replace(/ö/g, 'o')
        break
    }

    const url = routes.skolmaten(schoolId as string)
    const response = await this.fetch('skolmaten', url)

    if (response.status === 404) {
      return []
    }

    const responseText = await response.text()
    return scrapeMenus(responseText)
  }

  async getNotifications(child: EtjanstChild): Promise<Notification[]> {
    const unikumStartResponse = await this.fetch(
      'unikum-start',
      routes.unikumStart
    )
    const unikumStartResponseUrl = (unikumStartResponse as any).url
    const unikumBaseUrl = routes.getBaseUrl(unikumStartResponseUrl)
    const notificationsUrl = routes.unikumNotificationsUrl(
      unikumStartResponseUrl
    )
    const notificationsResponse = await this.fetch(
      'notifications',
      notificationsUrl
    )
    const notificationsResponseText = await notificationsResponse.text()
    const guardianId = scrapeNotificationsGuardianId(
      notificationsResponseText,
      child
    )
    const guardianNotificationsUrl = routes.unikumGuardianNotificationsUrl(
      unikumBaseUrl,
      guardianId
    )
    const guardianNotificationsResponse = await this.fetch(
      'notifications',
      guardianNotificationsUrl
    )
    const guardianNotificationsResponseText =
      await guardianNotificationsResponse.text()
    return scrapeNotifications(guardianNotificationsResponseText, unikumBaseUrl)
  }

  async getTeachers(child: EtjanstChild): Promise<Teacher[]> {
    return (await this.getClassPeople(child, 'lärare')).map((teacher) => {
      return {
        id: 0,
        active: true,
        firstname: teacher.firstname,
        lastname: teacher.lastname,
        sisId: '',
        status: '',
        timeTableAbbreviation:
          teacher.lastname.substring(0, 1).toUpperCase() +
          teacher.lastname
            .substring(teacher.lastname.length - 1)
            .toUpperCase() +
          teacher.firstname.substring(0, 1).toUpperCase(),
      }
    })
  }

  async getSchedule(
    child: EtjanstChild,
    from: DateTime,
    to: DateTime
  ): Promise<ScheduleItem[]> {
    return []
  }

  async getSchoolContacts(child: EtjanstChild): Promise<SchoolContact[]> {
    return []
  }

  async getSkola24Children(): Promise<Skola24Child[]> {
    return await this.skola24Service.getChildren()
  }

  async getTimetable(
    child: Skola24Child,
    week: number,
    year: number,
    lang: string
  ): Promise<TimetableEntry[]> {
    return await this.skola24Service.getTimetable(child, week, year)
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

  private async fetchNewsDetails(item: NewsItem) {
    let response = await this.fetch('current-user', routes.arenaNews(item.id))
    if (!response.ok) {
      throw new Error(
        `Server Error [${response.status}] [${response.statusText}] [${routes.arena}]`
      )
    }

    const body = await response.text()
    await scrapeNewsDetail(body, item)
  }

  private async getClassPeople(
    child: EtjanstChild,
    type: 'elever' | 'lärare'
  ): Promise<{ firstname: string; lastname: string; className: string }[]> {
    const unikumStartResponse = await this.fetch(
      'unikum-start',
      routes.unikumStart
    )
    const unikumResponseText = await unikumStartResponse.text()
    const unikumBaseUrl = routes.getBaseUrl((unikumStartResponse as any).url)
    const urlToChild = unikumBaseUrl + scrapeChildUrl(unikumResponseText, child)
    const childResponse = await this.fetch('child', urlToChild)
    const childResponseText = await childResponse.text()
    const classUrls = scrapeClassUrls(childResponseText)
    if (classUrls.length === 0) {
      return []
    }
    const classUrl = unikumBaseUrl + classUrls[0].href
    const classResponse = await this.fetch('class', classUrl)
    const classResponseText = await classResponse.text()
    return scrapeClassPeople(classResponseText, type, classUrls[0].name)
  }

  private async authenticateWithUnikum(): Promise<void> {
    const unikumResponse = await this.fetch('unikum', routes.unikumSso)
    const unikumResponseText = await unikumResponse.text()
    const samlForm =
      CommonService.extractSamlAuthResponseForm(unikumResponseText)
    await this.fetch('saml-login', samlForm.action, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `SAMLResponse=${encodeURIComponent(
        samlForm.samlResponse
      )}&RelayState=${encodeURIComponent(samlForm.relayState)}`,
    })
  }

  private log(...data: any[]) {
    console.log('[api-arena]', ...data)
  }
}
