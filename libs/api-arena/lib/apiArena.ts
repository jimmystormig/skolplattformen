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
  User,
  wrap,
} from '@skolplattformen/api'

import EventEmitter from 'events'
import { DateTime } from 'luxon'
import { DummyStatusChecker } from './dummyStatusChecker'
import { fakeFetcher } from './fake/fakeFetcher'
import { AlingsasService } from './service/alingsas.service'
import { ArenaService } from './service/arena.service'
import { Skola24Service } from './service/skola24.service'
import { SodexoService } from './service/sodexo.service'
import { UnikumService } from './service/unikum.service'

export class ApiArena extends EventEmitter implements Api {
  private originalFetcher: Fetcher
  private cookieManager: CookieManager
  private personalNumber?: string
  private arenaService: ArenaService
  private skola24Service: Skola24Service
  private unikumService: UnikumService
  private sodexoService: SodexoService
  private alingsasService: AlingsasService
  isFake = false
  isLoggedIn = false

  constructor(
    fetch: Fetch,
    cookieManager: CookieManager,
    options?: FetcherOptions
  ) {
    super()
    this.originalFetcher = wrap(fetch, options)
    this.cookieManager = cookieManager
    this.arenaService = new ArenaService(this.originalFetcher, this.log)
    this.skola24Service = new Skola24Service(this.originalFetcher, this.log)
    this.unikumService = new UnikumService(this.originalFetcher, this.log)
    this.sodexoService = new SodexoService(this.originalFetcher, this.log)
    this.alingsasService = new AlingsasService(this.originalFetcher, this.log)
  }

  getPersonalNumber = () => this.personalNumber

  login = async (personalNumber?: string): Promise<LoginStatusChecker> => {
    this.log('login', personalNumber)
    if (personalNumber !== undefined && personalNumber.endsWith('1212121212'))
      return this.fakeMode()

    this.useOriginalFetcher()
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
    console.log('setSessionCookie', sessionCookie)
    this.cookieManager.setCookieString(sessionCookie, ArenaService.arenaStart)

    await this.arenaService.authenticate()

    await Promise.all([
      this.skola24Service.authenticate(),
      this.unikumService.authenticate(),
    ])

    this.isLoggedIn = true
    this.emit('login')
  }

  getSessionHeaders = async (url: string) => {
    return {
      cookie: await this.cookieManager.getCookieString(url),
    }
  }

  async getUser() {
    const areAllAuthenticated = await Promise.all([
      this.skola24Service.isAuthenticated(),
      this.unikumService.isAuthenticated(),
    ])

    if (!areAllAuthenticated[0] || !areAllAuthenticated[1]) {
      return { isAuthenticated: false } as User
    }

    return await this.arenaService.getUser()
  }

  getChildren = async () => await this.arenaService.getChildren()

  getCalendar = async (child: EtjanstChild) =>
    this.alingsasService.getCalendar(child)

  getClassmates = async (child: EtjanstChild) =>
    (await this.unikumService.getClassPeople(child, 'elever')).map(
      (classmate) => {
        return {
          firstname: classmate.firstname,
          lastname: classmate.lastname,
          className: classmate.className,
          guardians: [],
          sisId: '',
        }
      }
    )

  getNews = async (child: EtjanstChild) => {
    return await this.arenaService.getNews(child)
  }

  getNewsDetails = async (_: EtjanstChild, item: NewsItem) => {
    return { ...item }
  }

  getMenu = (child: EtjanstChild) => this.sodexoService.getMenu(child)

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

  private async fakeMode(): Promise<LoginStatusChecker> {
    this.isFake = true
    this.useFakeFetcher()

    setTimeout(() => {
      this.isLoggedIn = true
      this.emit('login')
    }, 50)

    const emitter = new DummyStatusChecker()
    emitter.token = 'fake'
    return emitter
  }

  private useFakeFetcher() {
    this.arenaService.setFetcher(fakeFetcher)
    this.skola24Service.setFetcher(fakeFetcher)
    this.unikumService.setFetcher(fakeFetcher)
    this.sodexoService.setFetcher(fakeFetcher)
    this.alingsasService.setFetcher(fakeFetcher)
  }

  private useOriginalFetcher() {
    this.arenaService.setFetcher(this.originalFetcher)
    this.skola24Service.setFetcher(this.originalFetcher)
    this.unikumService.setFetcher(this.originalFetcher)
    this.sodexoService.setFetcher(this.originalFetcher)
    this.alingsasService.setFetcher(this.originalFetcher)
  }

  private log(...data: any[]) {
    console.log('[api-arena]', ...data)
  }
}
