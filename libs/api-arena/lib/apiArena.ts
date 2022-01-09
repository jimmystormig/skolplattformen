import {
  Api,
  CookieManager,
  EtjanstChild,
  Fetch,
  Fetcher,
  FetcherOptions,
  LoginStatusChecker,
  NewsItem,
  Skola24Child,
  wrap,
} from '@skolplattformen/api'

import EventEmitter from 'events'
import { DateTime } from 'luxon'
import { DummyStatusChecker } from './dummyStatusChecker'
import { AlingsasService } from './service/alingsas.service'
import { ArenaService } from './service/arena.service'
import { Skola24Service } from './service/skola24.service'
import { SkolmatenService } from './service/skolmaten.service'
import { UnikumService } from './service/unikum.service'

export class ApiArena extends EventEmitter implements Api {
  private fetch: Fetcher
  private cookieManager: CookieManager
  private personalNumber?: string
  private arenaService: ArenaService
  private skola24Service: Skola24Service
  private unikumService: UnikumService
  private skolmatenService: SkolmatenService
  private alingsasService: AlingsasService
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
    this.unikumService = new UnikumService(this.fetch, this.log)
    this.skolmatenService = new SkolmatenService(this.fetch, this.log)
    this.alingsasService = new AlingsasService(this.fetch, this.log)
  }

  public replaceFetcher(fetcher: Fetcher) {
    this.fetch = fetcher
  }

  getPersonalNumber = () => this.personalNumber

  login = async (personalNumber?: string): Promise<LoginStatusChecker> => {
    if (personalNumber !== undefined && personalNumber.endsWith('1212121212'))
      return this.fakeMode()

    this.isFake = false

    const status = await this.arenaService.authenticate(personalNumber)

    status.on('OK', async () => {
      this.isLoggedIn = true
      this.personalNumber = personalNumber
      await Promise.all([
        this.skola24Service.authenticate(),
        this.unikumService.authenticate(),
      ])
      this.emit('login')
    })
    status.on('ERROR', () => {
      this.personalNumber = undefined
    })

    await status.check()

    return status
  }

  setSessionCookie = async (sessionCookie: string) => {
    this.cookieManager.setCookieString(sessionCookie, ArenaService.arenaStart)

    const [arenaIsAuthenticatd, skola24IsAuthenticated, unikumIsAuthenticated] =
      await Promise.all([
        this.isAuthenticated(),
        this.skola24Service.isAuthenticated(),
        this.unikumService.isAuthenticated(),
      ])
    if (
      !arenaIsAuthenticatd ||
      !skola24IsAuthenticated ||
      !unikumIsAuthenticated
    ) {
      throw new Error('Session cookies has expired')
      // TODO Should we logout?
    }

    this.isLoggedIn = true
    this.emit('login')
  }

  getSessionHeaders = async (url: string) => {
    return {
      cookie: await this.cookieManager.getCookieString(url),
    }
  }

  getUser = async () => this.arenaService.getUser()

  getChildren = async () =>
    (await this.getSkola24Children()).map((child) => {
      return {
        id: child.personGuid as string,
        name: `${child.firstName} ${child.lastName}`,
        schoolId: child.schoolID,
        sdsId: '',
      }
    })

  getCalendar = async (child: EtjanstChild) =>
    this.alingsasService.getCalendar(child)

  getClassmates = async (child: EtjanstChild) =>
    await (
      await this.unikumService.getClassPeople(child, 'elever')
    ).map((classmate) => {
      return {
        firstname: classmate.firstname,
        lastname: classmate.lastname,
        className: classmate.className,
        guardians: [],
        sisId: '',
      }
    })

  getNews = async (child: EtjanstChild) => this.arenaService.getNews(child)

  getNewsDetails = async (_: EtjanstChild, item: NewsItem) => {
    return { ...item }
  }

  getMenu = (child: EtjanstChild) => this.skolmatenService.getMenu(child)

  getNotifications = (child: EtjanstChild) =>
    this.unikumService.getNotifications(child)

  getTeachers = async (child: EtjanstChild) =>
    (await this.unikumService.getClassPeople(child, 'lärare')).map(
      (teacher) => {
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
      }
    )

  // TODO Finns det någon schedule i Arena?
  getSchedule = async (child: EtjanstChild, from: DateTime, to: DateTime) => []

  // TODO Finns det någon school contact i Unikum eller Skola24?
  getSchoolContacts = async (child: EtjanstChild) => []

  getSkola24Children = async () => await this.skola24Service.getChildren()

  getTimetable = async (
    child: Skola24Child,
    week: number,
    year: number,
    lang: string
  ) => await this.skola24Service.getTimetable(child, week, year)

  logout = async () => {
    this.isFake = false
    this.isLoggedIn = false
    this.personalNumber = undefined
    this.cookieManager.clearAll()
    this.emit('logout')
  }

  async isAuthenticated() {
    const user = await this.getUser()
    return user.isAuthenticated
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

  private log(...data: any[]) {
    console.log('[api-arena]', ...data)
  }
}
