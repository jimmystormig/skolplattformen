import EventEmitter from 'events'
import * as html from 'node-html-parser'
import { decode } from 'he'
import { DateTime } from 'luxon'
import {
  EtjanstChild,
  Fetcher,
  LoginStatusChecker,
  NewsItem,
} from '@skolplattformen/api'
import { DummyStatusChecker } from '../dummyStatusChecker'
import { getBaseUrl } from './common'

export class ArenaService {
  static arenaStart: 'https://arena.alingsas.se'
  log: (...data: any[]) => void = () => {}
  private fetch: Fetcher
  private routes = {
    startpage: 'https://arena.alingsas.se',
    bankIdLandingPage: (baseUrl: string) =>
      baseUrl + '/wa/auth?authmech=tc6wyb5ukmps',
    bankIdAuth: (baseUrl: string) =>
      baseUrl + '/mg-local/auth/ccp11/grp/other/ssn',
    pollStatus: (baseUrl: string) =>
      baseUrl + '/mg-local/auth/ccp11/grp/pollstatus',
    authLoginUrl: 'https://idp1.alingsas.se/wa/auth/saml/',
    samlLoginUrl: 'https://arena.alingsas.se/Shibboleth.sso/SAML2/POST',
    currentUser: 'https://arena.alingsas.se/user',
    arenaNews: (newsPath: string) => `${ArenaService.arenaStart}${newsPath}`,
  }

  constructor(fetch: Fetcher, log: (...data: any[]) => void) {
    this.fetch = fetch
    this.log = (...data) => log('[arena-service]', ...data)
  }

  async authenticate(personalNumber?: string): Promise<ArenaStatusChecker> {
    this.log('Authenticating...')

    const startpageResponseUrl = await this.getStartpgageUrl()
    if (this.isStartpage(startpageResponseUrl)) {
      this.log('Already authenticated')
      return ArenaService.emitOk()
    }

    const authTicket = await this.generateAuthTicket(
      startpageResponseUrl,
      personalNumber
    )

    const status = new ArenaStatusChecker(this, authTicket.landingPageBaseUrl)

    status.on('OK', async () => {
      this.log('Authenticated')
    })
    status.on('PENDING', () => {
      this.log('Login pending')
    })
    status.on('ERROR', (error) => {
      this.log('Login error', error)
    })

    return status
  }

  async getPollStatus(basePollUrl: string) {
    const pollStatusResponse = await this.fetch(
      'arena-bankid-status',
      this.routes.pollStatus(basePollUrl)
    )

    const pollStatusResponseJson = await pollStatusResponse.json()
    const keepPolling = pollStatusResponseJson.infotext !== ''
    const isError = pollStatusResponseJson.location.indexOf('error') >= 0

    return {
      keepPolling,
      isError,
      location: pollStatusResponseJson.location,
    }
  }

  async login(signatureUrl: string) {
    const authLoginBody = await this.getSigntureAuthBody(signatureUrl)
    const samlLoginBody = await this.getSamlLoginBody(authLoginBody)
    await this.samlLogin(samlLoginBody)
  }

  async getUser() {
    this.log('Getting user')

    const getUserResponse = async () => {
      return await this.fetch('arena-current-user', this.routes.currentUser)
    }

    let userPageResponse = await getUserResponse()
    if (userPageResponse.status !== 200) {
      return { isAuthenticated: false }
    }

    if ((userPageResponse as any).url !== this.routes.currentUser) {
      // Response was redirected, some cookie was probably missing, try again
      userPageResponse = await getUserResponse()
      if (
        userPageResponse.status !== 200 ||
        (userPageResponse as any).url !== this.routes.currentUser
      ) {
        // Give up
        return { isAuthenticated: false }
      }
    }

    var body = await userPageResponse.text()

    const doc = html.parse(decode(body))

    const firstName = doc.querySelector(
      '.field-name-field-firstname .field-item'
    ).rawText
    const lastName = doc.querySelector(
      '.field-name-field-lastname .field-item'
    ).rawText
    const email = doc.querySelector(
      '.field-name-field-user-email .field-item'
    ).rawText

    return {
      isAuthenticated: true,
      firstName: firstName,
      lastName: lastName,
      email: email,
    }
  }

  async getNews(child: EtjanstChild): Promise<NewsItem[]> {
    let response = await this.fetch('current-user', ArenaService.arenaStart)
    const baseUrl = getBaseUrl((response as any).url)
    let body = await response.text()

    body = await this.handleCustiodian(body, baseUrl)

    const doc = html.parse(decode(body))
    const childNews = doc
      .querySelectorAll('.children .child .child-block')
      .filter((block) => block.querySelector('h2')?.rawText === child.name)
    const linksOfLinks = childNews.map((block) =>
      block.querySelectorAll(
        'ul.arena-guardian-child-info li.news-and-infoblock-item a'
      )
    )
    const news: NewsItem[] = []

    linksOfLinks.forEach((links) => {
      links.forEach((link) => {
        const viewed = link.classNames.indexOf('node-viewed') > -1 ? '' : '◉ '
        news.push({
          id: link.getAttribute('href') as string,
          header: viewed + link.text,
          published: '',
        })
      })
    })

    const details = news.map((n) => this.fetchNewsDetails(n))
    await Promise.all(details)

    return news
  }

  private async handleCustiodian(body: string, baseUrl: string) {
    const custodianUrl = ArenaService.extractArenaAsCustodianUrl(body, baseUrl)

    if (!custodianUrl) {
      return body
    }

    let custodianResponse = await this.fetch(
      'current-user-custodian',
      custodianUrl
    )
    return await custodianResponse.text()
  }

  private async fetchNewsDetails(item: NewsItem) {
    let response = await this.fetch(
      'current-user',
      this.routes.arenaNews(item.id)
    )
    if (!response.ok) {
      throw new Error(
        `Server Error [${response.status}] [${response.statusText}] [${ArenaService.arenaStart}]`
      )
    }

    const responseText = await response.text()

    const doc = html.parse(decode(responseText))
    const newsBlock = doc.querySelector('.node-news')
    var rawDate = newsBlock.querySelector(
      '.submitted .date-display-single'
    )?.rawText
    var date = DateTime.fromFormat(rawDate, 'dd MMM yyyy', { locale: 'sv' })
    var imageUrl = newsBlock
      .querySelector('.field-name-field-image img')
      ?.getAttribute('src')
    var header = newsBlock.querySelector('h1 span')?.rawText
    var intro = newsBlock.querySelector(
      '.field-name-field-introduction .field-item'
    )?.rawText
    var body = newsBlock.querySelector('.field-name-body .field-item')?.rawText
    var attached = newsBlock
      .querySelectorAll('.field-name-field-attached-files .field-item a')
      .map((a) => {
        return {
          url: a.getAttribute('href'),
          name: a.rawText,
        }
      })
      .reduce<string>((i, el) => {
        return i + '[' + el.name + '](' + el.url + ')  \n'
      }, '')

    body =
      (body ? body + '\n\n' : '') +
      intro +
      (body || intro ? '\n\n' : '') +
      attached

    item.header = header
    item.intro = intro
    item.body = body
    item.author = newsBlock.querySelector('.submitted .username')?.rawText
    item.published = date.toISODate()
    item.fullImageUrl = imageUrl
  }

  private async getStartpgageUrl(): Promise<string> {
    const startpageResponse = await this.fetch(
      'arena-startpage',
      this.routes.startpage
    )
    return (startpageResponse as any).url as string
  }

  private async generateAuthTicket(
    startpageResponseUrl: string,
    personalNumber?: string
  ): Promise<{ landingPageBaseUrl: string }> {
    this.log('Generating auth ticket')
    const landingPageResponse = await this.fetch(
      'arena-bankid-landingpage',
      this.routes.bankIdLandingPage(getBaseUrl(startpageResponseUrl))
    )
    const landingPageBaseUrl = getBaseUrl((landingPageResponse as any).url)
    await this.fetch(
      'arena-bankid-auth',
      this.routes.bankIdAuth(landingPageBaseUrl),
      {
        redirect: 'follow',
        method: 'POST',
        body: 'ssn=' + personalNumber,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )
    return { landingPageBaseUrl }
  }

  private isStartpage = (startpageResponseUrl: string) =>
    startpageResponseUrl.startsWith(this.routes.startpage)

  private async getSigntureAuthBody(signatureUrl: string) {
    const signatureResponse = await this.fetch(
      'arena-confirm-signature-redirect',
      signatureUrl,
      {
        redirect: 'follow',
      }
    )
    if (!signatureResponse.ok) {
      throw new Error('Bad signature response')
    }
    const signatureResponseText = await signatureResponse.text()
    return ArenaService.extractAuthLoginRequestBody(signatureResponseText)
  }

  private async getSamlLoginBody(authLoginBody: string) {
    const authLoginResponse = await this.fetch(
      'arena-auth-saml-login',
      this.routes.authLoginUrl,
      {
        redirect: 'follow',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Connection: 'keep-alive',
        },
        body: authLoginBody,
      }
    )
    if (!authLoginResponse.ok) {
      throw new Error('Bad authLogin response')
    }
    const authLoginResponseText = await authLoginResponse.text()
    return ArenaService.extractSAMLLogin(authLoginResponseText)
  }

  private async samlLogin(samlLoginBody: string) {
    const samlLoginResponse = await this.fetch(
      'arena-saml-login',
      this.routes.samlLoginUrl,
      {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: samlLoginBody,
      }
    )
    if (!samlLoginResponse.ok) {
      throw new Error('Bad samlLogin response')
    }
  }

  private static extractArenaAsCustodianUrl(
    body: string,
    baseUrl: string
  ): string | undefined {
    const doc = html.parse(decode(body))
    const anchor = doc.querySelector(
      'a[href="/arena/guardian/masquerade-as-custodian"]'
    )
    if (anchor) {
      return baseUrl + anchor.getAttribute('href')
    }

    return undefined
  }

  private static extractAuthLoginRequestBody(signatureResponseText: string) {
    const signatureResponseDoc = html.parse(decode(signatureResponseText))
    const signatureResponseTextAreas =
      signatureResponseDoc.querySelectorAll('textarea')
    const SAMLResponseElem = signatureResponseTextAreas.find((ta) => {
      const nameAttr = ta.getAttribute('name')
      return nameAttr === 'SAMLResponse'
    })
    const SAMLResponseText = SAMLResponseElem?.rawText
    const RelayStateElem = signatureResponseTextAreas.find((ta) => {
      const nameAttr = ta.getAttribute('name')
      return nameAttr === 'RelayState'
    })
    const RelayStateText = RelayStateElem?.rawText
    return `SAMLResponse=${encodeURIComponent(
      SAMLResponseText || ''
    )}&RelayState=${encodeURIComponent(RelayStateText || '')}`
  }

  private static extractSAMLLogin(authLoginResponseText: string) {
    const authLoginDoc = html.parse(decode(authLoginResponseText))
    const inputAttrs = authLoginDoc
      .querySelectorAll('input')
      .map((i) => (i as any).rawAttrs)
    const RelayStateText = ArenaService.extractInputField(
      'RelayState',
      inputAttrs
    )
    const SAMLResponseText = ArenaService.extractInputField(
      'SAMLResponse',
      inputAttrs
    )
    return `SAMLResponse=${encodeURIComponent(
      SAMLResponseText || ''
    )}&RelayState=${encodeURIComponent(RelayStateText || '')}`
  }

  private static extractInputField = (sought: string, attrs: string[]) => {
    const s = attrs.find((e) => e.indexOf(sought) >= 0) || ''
    const v = s.substring(s.indexOf('value="') + 'value="'.length)
    return v.substring(0, v.length - 2)
  }

  private static emitOk() {
    const emitter = new DummyStatusChecker()
    setTimeout(() => {
      emitter.emit('OK')
    }, 50)
    return emitter as ArenaStatusChecker
  }
}

export class ArenaStatusChecker
  extends EventEmitter
  implements LoginStatusChecker
{
  private arenaService: ArenaService
  private basePollUrl: string
  private cancelled = false
  token = ''

  constructor(arenaService: ArenaService, basePollUrl: string) {
    super()
    this.arenaService = arenaService
    this.basePollUrl = basePollUrl
  }

  async check(): Promise<void> {
    const pollStatus = await this.arenaService.getPollStatus(this.basePollUrl)

    try {
      if (!pollStatus.keepPolling && !pollStatus.isError) {
        await this.arenaService.login(pollStatus.location)
        this.emit('OK')
      } else if (pollStatus.isError) {
        this.emit('ERROR', 'Polling error')
      } else if (!this.cancelled && pollStatus.keepPolling) {
        this.emit('PENDING')
        setTimeout(() => this.check(), 3000)
      }
    } catch (error) {
      this.emit('ERROR', error)
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true
  }
}
