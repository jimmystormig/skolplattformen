import * as html from 'node-html-parser'
import { decode } from 'he'
import { DateTime } from 'luxon'
import { Fetcher, Skola24Child, TimetableEntry } from '@skolplattformen/api'
import { extractSamlAuthResponseForm } from './common'
export class Skola24Service {
  log: (...data: any[]) => void = () => {}
  public isAuthenticated: boolean = false

  private fetch: Fetcher
  private routes = {
    skola24: 'https://idp.alingsas.se/skolfed/skola24',
    skola24Timetables:
      'https://web.skola24.se/api/services/skola24/get/personal/timetables',
    skola24Host: 'alingsas-sso.skola24.se',
    skola24TimetableKey: 'https://web.skola24.se/api/get/timetable/render/key',
    skola24Timetable: 'https://web.skola24.se/api/render/timetable',
    skola24PreSchools: 'https://web.skola24.se/api/get/preschools',
    skola24PreSchoolStudents:
      'https://web.skola24.se/api/get/groups/per/preschools/with/students',
    skola24Timeframes:
      'https://web.skola24.se/api/get/timetable/day/with/timeframes/day',
  }

  constructor(fetch: Fetcher, log: (...data: any[]) => void) {
    this.fetch = fetch
    this.log = (...data) => log('[skola24-service]', ...data)
  }

  async authenticate() {
    this.log('Authenticating...')
    const skola24Response = await this.fetch(
      'skola24-start',
      this.routes.skola24
    )
    const skola24ResponseText = await skola24Response.text()
    const ssoLoginUrl = await Skola24Service.extractFrameSource(
      skola24ResponseText
    )
    const skola24LoginResponse = await this.fetch(
      'skola24-login',
      (skola24Response as any).url + ssoLoginUrl
    )
    const skola24LoginResponseText = await skola24LoginResponse.text()
    const skola24LoginNovaSsoUrl = Skola24Service.extractLoginNovaSsoUrl(
      skola24LoginResponseText
    )
    const skola24LoginNovaSsoResponse = await this.fetch(
      'skola24-login-nova-sso',
      skola24LoginNovaSsoUrl as string
    )
    const skola24LoginNovaSsoResponseText =
      await skola24LoginNovaSsoResponse.text()
    const alingsasSamlAuthForm =
      Skola24Service.extractAlingsasSamlAuthRequestForm(
        skola24LoginNovaSsoResponseText
      )
    const alingsasSamlAuthRequestResponse = await this.fetch(
      'skola24-alingsas-saml-auth',
      alingsasSamlAuthForm.action,
      {
        redirect: 'follow',
        method: 'POST',
        body:
          'SAMLRequest=' + encodeURIComponent(alingsasSamlAuthForm.samlRequest),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: 'https://service-sso1.novasoftware.se/',
          Connection: 'keep-alive',
        },
      }
    )
    const alingsasSamlAuthRequestResponseText =
      await alingsasSamlAuthRequestResponse.text()
    const alingsasSamlAuthResponseForm = extractSamlAuthResponseForm(
      alingsasSamlAuthRequestResponseText
    )
    await this.fetch(
      'skola24-nova-saml-auth',
      alingsasSamlAuthResponseForm.action,
      {
        redirect: 'follow',
        method: 'POST',
        body: `SAMLResponse=${encodeURIComponent(
          alingsasSamlAuthResponseForm.samlResponse
        )}&RelayState=${encodeURIComponent(
          alingsasSamlAuthResponseForm.relayState
        )}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: 'https://idp2.alingsas.se/',
          Connection: 'keep-alive',
        },
      }
    )
    this.isAuthenticated = true
    this.log('Authenticated')
  }

  async getChildren(): Promise<Skola24Child[]> {
    this.log('getChildren')

    if (!this.isAuthenticated) {
      await this.authenticate()
      this.isAuthenticated = true
    }

    const timetablesResponse = await this.fetch(
      'skola24-timetables',
      this.routes.skola24Timetables,
      {
        method: 'POST',
        body:
          '{"getPersonalTimetablesRequest":{"hostName":"' +
          this.routes.skola24Host +
          '"}}',
        headers: {
          referrer:
            'https://web.skola24.se/portal/start/timetable/timetable-viewer',
          'x-scope': '8a22163c-8662-4535-9050-bc5e1923df48',
          ...this.skola24CommonHeaders,
        },
      }
    )
    const timetables = await timetablesResponse?.json()

    const children =
      timetables.data.getPersonalTimetablesResponse.childrenTimetables

    if (!children || children.length === 0) {
      this.isAuthenticated = false
      throw new Error('Server Error - Session has expired')
    }

    this.isAuthenticated = true

    return children
  }

  async getTimetable(
    child: Skola24Child,
    week: number,
    year: number
  ): Promise<TimetableEntry[]> {
    this.log('getTimetable')
    if (!child.personGuid) {
      return []
    }

    const childrenTimetables = await this.getChildren()
    if (childrenTimetables.length === 0) {
      return []
    }

    const timetableForChild = childrenTimetables.find(
      (timetable: any) => timetable.personGuid === child.personGuid
    )
    if (!timetableForChild) {
      throw new Error(
        `Could not find timetable for child ${child.firstName} ${
          child.lastName
        } with id ${child.personGuid} (timetables: ${JSON.stringify(
          childrenTimetables
        )})`
      )
    }

    const timetableKeyResponse = await this.fetch(
      'skola24-timetable-key',
      this.routes.skola24TimetableKey,
      {
        method: 'POST',
        body: 'null',
        headers: {
          'x-scope': '8a22163c-8662-4535-9050-bc5e1923df48',
          referrer:
            'https://web.skola24.se/portal/start/timetable/timetable-viewer/alingsas-sso.skola24.se/',
          ...this.skola24CommonHeaders,
        },
      }
    )
    const timetableData = await timetableKeyResponse.json()
    const timetableKey = timetableData.data.key

    const timetableResponse = await this.fetch(
      'skola24-timetable',
      this.routes.skola24Timetable,
      {
        method: 'POST',
        body: JSON.stringify({
          renderKey: timetableKey,
          host: this.routes.skola24Host,
          unitGuid: timetableForChild.unitGuid,
          startDate: null,
          endDate: null,
          scheduleDay: 0,
          blackAndWhite: false,
          width: 1000,
          height: 550,
          selectionType: 5,
          selection: timetableForChild.personGuid,
          showHeader: false,
          periodText: '',
          week: week,
          year: year,
          privateFreeTextMode: null,
          privateSelectionMode: true,
          customerKey: '',
        }),
        headers: {
          referrer:
            'https://web.skola24.se/portal/start/timetable/timetable-viewer/alingsas-sso.skola24.se/',
          'x-scope': '8a22163c-8662-4535-9050-bc5e1923df48',
          ...this.skola24CommonHeaders,
        },
      }
    )

    const timetable = await timetableResponse.json()

    const lessonInfo = timetable.data.lessonInfo
      ? timetable.data.lessonInfo.map((lesson: any) => {
          return {
            id: lesson.guidId,
            teacher: lesson.texts[1],
            location: lesson.texts[2],
            timeStart: lesson.timeStart,
            timeEnd: lesson.timeEnd,
            dayOfWeek: lesson.dayOfWeekNumber,
            name: lesson.texts[0],
            dateStart: DateTime.fromObject({
              weekYear: year,
              weekNumber: week,
              weekday: lesson.dayOfWeekNumber,
            }).toISODate(),
            dateEnd: DateTime.fromObject({
              weekYear: year,
              weekNumber: week,
              weekday: lesson.dayOfWeekNumber,
            }).toISODate(),
          }
        })
      : []

    const today = DateTime.local().toISODate()

    const preSchoolsResponse = await this.fetch(
      'skola24-pre-schools',
      this.routes.skola24PreSchools,
      {
        method: 'POST',
        body: 'null',
        headers: {
          referrer:
            'https://web.skola24.se/portal/start/timetable/timetable-exception',
          'x-scope': '47b9ccc3-3b42-4c45-a2c9-0e60d11d9dc8',
          ...this.skola24CommonHeaders,
        },
      }
    )

    const preSchools = await preSchoolsResponse.json()
    const preSchoolGuid = preSchools.data.schools[0].guid

    const preSchoolStudentsBody = JSON.stringify({
      schoolGuids: [preSchoolGuid],
      groupDates: { start: today, end: today },
      groupGuids: [],
      includeStudents: true,
      includeArchived: false,
      dateFrom: today,
      dateTo: today,
    })
    const skola24PreSchoolStudentsResponse = await this.fetch(
      'skola24-pre-school-stundents',
      this.routes.skola24PreSchoolStudents,
      {
        method: 'POST',
        body: preSchoolStudentsBody,
        headers: {
          referrer:
            'https://web.skola24.se/portal/start/timetable/timetable-exception',
          'x-scope': '47b9ccc3-3b42-4c45-a2c9-0e60d11d9dc8',
          ...this.skola24CommonHeaders,
        },
      }
    )
    const preSchoolStudents = await skola24PreSchoolStudentsResponse.json()

    const preSchool = (preSchoolStudents.data.privateStudents as [])
      .map((student: any) => {
        return {
          name: student.name,
          guid: student.guid,
          preschoolUnitGuid: student.preschoolUnitGuid,
          preschoolUnitName: student.preschoolUnitName,
          preSchoolGuid: preSchoolGuid,
        }
      })
      .find(
        (student: any) =>
          student.name === child.firstName + ' ' + child.lastName
      )

    if (preSchool) {
      const firstDayOfWeek = DateTime.fromObject({
        weekYear: year,
        weekNumber: week,
        weekday: 1,
      })

      for (let i = 0; i < 5; i++) {
        await this.getTimeframeTable(
          preSchool,
          firstDayOfWeek.plus({ days: i }),
          lessonInfo
        )
      }
    }

    return lessonInfo.sort((a: TimetableEntry, b: TimetableEntry) => {
      if (a.dayOfWeek === b.dayOfWeek) {
        return a.timeStart < b.timeStart ? -1 : 1
      } else {
        return a.dayOfWeek < b.dayOfWeek ? -1 : 1
      }
    })
  }

  private async getTimeframeTable(
    preSchool: any,
    dateFrom: DateTime,
    lessonInfo: any[]
  ) {
    const timeFramesResponse = await this.fetch(
      'skola24-timeframes',
      this.routes.skola24Timeframes,
      {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: dateFrom.toISODate(),
          preschoolUnitGuid: preSchool.preschoolUnitGuid,
          schoolGuid: preSchool.preSchoolGuid,
          studentPersonGuid: preSchool.guid,
        }),
        headers: {
          referrer:
            'https://web.skola24.se/portal/start/timetable/timetable-exception',
          'x-scope': '47b9ccc3-3b42-4c45-a2c9-0e60d11d9dc8',
          ...this.skola24CommonHeaders,
        },
      }
    )

    const timeFrames = await timeFramesResponse.json()
    const timetable = timeFrames.data.timetable

    if (timetable.timetableTimes.length === 0) {
      return
    }

    const timeFrameTable = {
      id: 'skola24_timeframes',
      teacher: '',
      location: preSchool.preschoolUnitName,
      timeStart: DateTime.fromFormat(
        timetable.exceptionTimes.length > 0
          ? timetable.exceptionTimes[0].start
          : timetable.timetableTimes[0].start,
        'HH:mm'
      ).toISOTime(),
      timeEnd: DateTime.fromFormat(
        timetable.exceptionTimes.length > 0
          ? timetable.exceptionTimes[0].stop
          : timetable.timetableTimes[0].stop,
        'HH:mm'
      ).toISOTime(),
      dayOfWeek: dateFrom.weekday,
      name:
        'Vistelsetid' +
        (timetable.exceptionDayComment ? ' (tillfälligt ändrad)' : ''),
      dateStart: dateFrom.toISODate(),
      dateEnd: dateFrom.toISODate(),
    }

    lessonInfo.push(timeFrameTable)
  }

  private skola24CommonHeaders = {
    accept: 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'sv,en;q=0.9,en-US;q=0.8',
    'cache-control': 'no-cache',
    'content-type': 'application/json',
    pragma: 'no-cache',
    'x-requested-with': 'XMLHttpRequest',
    mode: 'cors',
    credentials: 'include',
    referrerPolicy: 'strict-origin-when-cross-origin',
  }

  private static extractFrameSource(skola24SSOResponseText: string) {
    const doc = html.parse(decode(skola24SSOResponseText))
    const frame = doc.querySelector('frameset frame')
    const src = frame?.getAttribute('src')
    return src
  }

  private static extractLoginNovaSsoUrl(skola24LoginResponseText: string) {
    const doc = html.parse(decode(skola24LoginResponseText))
    const script = doc.querySelector('script')
    const scriptText = script?.rawText
    const match = scriptText?.match(/(?<== ').*(?=';)/)
    return match && match[0]
  }

  private static extractAlingsasSamlAuthRequestForm(
    skola24LoginNovaSsoResponseText: string
  ) {
    const doc = html.parse(decode(skola24LoginNovaSsoResponseText))
    const form = doc.querySelector('form')
    const action = form?.getAttribute('action') || ''
    const input = doc.querySelector('input[name="SAMLRequest"]')
    const samlRequest = input?.getAttribute('value') || ''
    return {
      action,
      samlRequest,
    }
  }
}
