import * as html from 'node-html-parser'
import { decode } from 'he'
import {
  EtjanstChild,
  Fetcher,
  Notification,
  Response,
} from '@skolplattformen/api'
import { extractSamlAuthResponseForm, getBaseUrl } from './common'

export class UnikumService {
  public isAuthenticated: boolean = false
  log: (...data: any[]) => void = () => {}

  private fetch: Fetcher
  private routes = {
    unikumSso: 'https://idp.alingsas.se/skolfed/unikum',
    unikumStart: 'https://start.unikum.net/unikum/start.html',
    unikumNotificationsUrl: (startpageUrl: string) =>
      startpageUrl.replace('start.html', 'notifications/notifications.html') +
      '&includeActedOn=false',
    unikumGuardianNotificationsUrl: (
      nikumBaseUrl: string,
      guardianId: string
    ) =>
      `${nikumBaseUrl}/unikum/notifications/guardian/${guardianId}/unread/list.ajax?startIndex=0`,
  }

  constructor(fetch: Fetcher, log: (...data: any[]) => void) {
    this.fetch = fetch
    this.log = (...data) => log('[unikum-service]', ...data)
  }

  async authenticate(): Promise<void> {
    this.log('Authenticating...')
    const unikumResponse = await this.fetch('unikum', this.routes.unikumSso)
    const unikumResponseText = await unikumResponse.text()
    const samlForm = extractSamlAuthResponseForm(unikumResponseText)
    await this.fetch('saml-login', samlForm.action, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `SAMLResponse=${encodeURIComponent(
        samlForm.samlResponse
      )}&RelayState=${encodeURIComponent(samlForm.relayState)}`,
    })
    this.isAuthenticated = true
    this.log('Authenticated')
  }

  async getClassPeople(
    child: EtjanstChild,
    type: 'elever' | 'lärare'
  ): Promise<{ firstname: string; lastname: string; className: string }[]> {
    this.log('getClassPeople')

    if (!this.isAuthenticated) {
      await this.authenticate()
      throw new Error('Server Error - Session has expired')
    }

    const unikumStartResponse = await this.fetch(
      'unikum-start',
      this.routes.unikumStart
    )

    if (!UnikumService.isAuthenticated(unikumStartResponse)) {
      this.isAuthenticated = false
      throw new Error('Server Error - Session has expired')
    }
    this.isAuthenticated = true

    const unikumResponseText = await unikumStartResponse.text()
    const unikumBaseUrl = getBaseUrl((unikumStartResponse as any).url)
    const urlToChild =
      unikumBaseUrl + UnikumService.scrapeChildUrl(unikumResponseText, child)
    const childResponse = await this.fetch('child', urlToChild)
    const childResponseText = await childResponse.text()
    const classUrls = UnikumService.scrapeClassUrls(childResponseText)
    if (classUrls.length === 0) {
      return []
    }
    const classUrl = unikumBaseUrl + classUrls[0].href
    const classResponse = await this.fetch('class', classUrl)
    const classResponseText = await classResponse.text()
    return UnikumService.scrapeClassPeople(
      classResponseText,
      type,
      classUrls[0].name
    )
  }

  async getNotifications(child: EtjanstChild): Promise<Notification[]> {
    this.log('getNotifications')

    if (!this.isAuthenticated) {
      await this.authenticate()
      throw new Error('Server Error - Session has expired')
    }

    const unikumStartResponse = await this.fetch(
      'unikum-start',
      this.routes.unikumStart
    )

    if (!UnikumService.isAuthenticated(unikumStartResponse)) {
      this.isAuthenticated = false
      throw new Error('Server Error - Session has expired')
    }
    this.isAuthenticated = true

    const unikumStartResponseUrl = (unikumStartResponse as any).url
    const unikumBaseUrl = getBaseUrl(unikumStartResponseUrl)
    const notificationsUrl = this.routes.unikumNotificationsUrl(
      unikumStartResponseUrl
    )
    const notificationsResponse = await this.fetch(
      'notifications',
      notificationsUrl
    )
    const notificationsResponseText = await notificationsResponse.text()
    const guardianId = UnikumService.scrapeNotificationsGuardianId(
      notificationsResponseText,
      child
    )
    const guardianNotificationsUrl = this.routes.unikumGuardianNotificationsUrl(
      unikumBaseUrl,
      guardianId
    )
    const guardianNotificationsResponse = await this.fetch(
      'notifications',
      guardianNotificationsUrl
    )
    const guardianNotificationsResponseText =
      await guardianNotificationsResponse.text()
    return UnikumService.scrapeNotifications(
      guardianNotificationsResponseText,
      unikumBaseUrl
    )
  }

  private static isAuthenticated = (startResponse: Response) =>
    (startResponse as any).url.indexOf('login.jsp') === -1

  private static scrapeNotificationsGuardianId(
    body: string,
    child: EtjanstChild
  ): string {
    const doc = html.parse(body)
    return doc
      .querySelectorAll(
        '#notifications_guardian_guardian .notification-container .collapsable-header'
      )
      .find(
        (container) =>
          container
            .querySelector('h3')
            .childNodes[2].rawText.replace('\n', '')
            .trim() === child.name
      )
      ?.getAttribute('data-target')
      ?.replace('#notifications_guardian_', '') as string
  }

  private static scrapeChildUrl(
    body: string,
    child: EtjanstChild
  ): string | undefined {
    const doc = html.parse(body)
    return doc
      .querySelectorAll('.card.principalcard .card-body')
      .find(
        (cardBody) =>
          cardBody.querySelector('.principalcard__name').rawText === child.name
      )
      ?.getAttribute('href')
  }

  private static scrapeClassUrls(
    body: string
  ): { href: string; name: string }[] {
    const doc = html.parse(body)
    return doc
      .querySelectorAll('.row.relations .card.principalcard.group .card-body')
      .filter(
        (cardBody) => !cardBody.parentNode.classNames.includes('tuitiongroup')
      )
      .map((cardBody) => {
        return {
          href: cardBody.getAttribute('href') as string,
          name: cardBody.getAttribute('data-testid') as string,
        }
      })
      .filter(
        (c) =>
          c.name.match(/^[A-Z|Å|Ä|Ö]{3}[0-9]{2}[0-9|A-Z|a-z|Å|å|Ä|ä|Ö|ö]*$/) !==
          null
      )
  }

  private static scrapeClassPeople(
    body: string,
    type: 'elever' | 'lärare',
    className: string
  ): { firstname: string; lastname: string; className: string }[] {
    const doc = html.parse(body)
    return doc
      .querySelectorAll('.panel.panel-borderless')
      .filter((panel) =>
        panel
          .querySelector('.panel-title')
          .rawText.trim()
          .toLowerCase()
          .startsWith(type)
      )
      .map((panel) =>
        panel
          .querySelectorAll('.card.principalcard .principalcard__name')
          .map((name) => name.rawText)
      )
      .flat()
      .sort()
      .map((name) => {
        return {
          firstname: name.substring(0, name.indexOf(' ')),
          lastname: name.substring(name.indexOf(' ') + 1),
          className: className,
        }
      })
  }

  private static scrapeNotifications(
    body: string,
    baseUrl: string
  ): Notification[] {
    const doc = html.parse(
      decode('<html><head></head><body>' + body + '</body></html>')
    )
    const anchors = doc.querySelectorAll('div.notification')

    return anchors
      .map((notification) => {
        const anchor = notification.childNodes[3] as any as HTMLElement
        const href = anchor.getAttribute('href') as string
        const message = (anchor.childNodes[2] as any)?.rawText
          .replace(/(?:\r\n|\r|\n)/g, ' ')
          .replace(/\s\s+/g, ' ')
          .trim()
        const date = anchor
          .querySelector('.meta .jq-notification-date')
          ?.getAttribute('data-date') as string

        return {
          id: href,
          category: null,
          message: message,
          dateCreated: date,
          dateModified: date,
          sender: 'Unikum',
          type: 'notification',
          url: baseUrl + href,
        }
      })
      .filter((notification) => notification.id !== undefined)
  }
}
