import * as html from 'node-html-parser'
import { decode } from 'he'
import { DateTime } from 'luxon'
import { CalendarItem, EtjanstChild, Fetcher } from '@skolplattformen/api'

export class AlingsasService {
  log: (...data: any[]) => void = () => {}
  private fetch: Fetcher
  private routes = {
    schoolyearCalendar:
      'https://www.alingsas.se/utbildning-och-barnomsorg/lasarstider/lasarstider-for-forskola-grundskola-och-fritidshem/',
  }

  constructor(fetch: Fetcher, log: (...data: any[]) => void) {
    this.fetch = fetch
    this.log = (...data) => log('[alingsas-service]', ...data)
  }

  async getCalendar(child: EtjanstChild): Promise<CalendarItem[]> {
    const response = await this.fetch(
      'alingsas-schoolyear-calendar',
      this.routes.schoolyearCalendar
    )
    const responseText = await response.text()
    const doc = html.parse(decode(responseText))

    interface CalendarItemExtended extends CalendarItem {
      filterableStartDate: any
      filterableEndDate: any
    }

    const today = DateTime.local()
    const inAYear = today.plus({ years: 1 })
    const items: CalendarItemExtended[] = []

    let autumnTermYear: number, springTermYear: number

    doc
      .querySelectorAll(
        '.entry-content p, .entry-content h2, .entry-content ul'
      )
      .map((item) => {
        if ((item as any).rawTagName === 'ul') {
          return item.childNodes.map((child) =>
            child
              .toString()
              .replace(/<br>/g, '\n')
              .replace(/<li>|<\/li>/g, '')
          )
        }

        return [item.rawText.trim()]
      })
      .flat()
      .filter((item) => item && item.length > 0 && item !== 'NULL')
      .map((item) => {
        let didMatchTermYear = false
        const termYearExp = /läsår ([0-9]{4})\/([0-9]{4})/gi
        const termYearExpMatches = [...item.matchAll(termYearExp)]
        for (const shcoolYearExpMatch of termYearExpMatches) {
          autumnTermYear = parseInt(shcoolYearExpMatch[1])
          springTermYear = parseInt(shcoolYearExpMatch[2])
          didMatchTermYear = true
        }

        if (didMatchTermYear) {
          return
        }

        let didMatchWeek = false
        const weekExp =
          /^(?=.*\b[V|v]ecka ([0-9]{1,2})\b)(?=.*\b([0-9]{4})\b).*$/g
        const weekMatches = [...item.matchAll(weekExp)]

        for (const weekMatch of weekMatches) {
          const title = weekMatch[0]
          const week = weekMatch[1]
          const year = weekMatch[2]
          const date = DateTime.fromObject({
            weekYear: parseInt(year),
            weekNumber: parseInt(week),
            weekday: 1,
          })
          const endDate = date.plus({ weeks: 1 })

          items.push({
            id: AlingsasService.hashCode(title) + date.toMillis(),
            title: title,
            startDate: date.toISO(),
            filterableStartDate: date,
            endDate: endDate.toISO(),
            filterableEndDate: endDate,
            allDay: true,
          })

          didMatchWeek = true
        }

        const dayMonthMatches = item.match(/[0-9]{1,2}\/[0-9]{1,2}/g)

        let didMatchTerm = false
        let term: 'autumn' | 'spring'
        const termMatches = item.match(/hösttermin|vårtermin/gi)
        if (termMatches && dayMonthMatches) {
          term =
            termMatches[0].toLowerCase() === 'hösttermin' ? 'autumn' : 'spring'
          const termYear = term === 'autumn' ? autumnTermYear : springTermYear
          const dayMonth = dayMonthMatches[0]
          const date = DateTime.fromObject({
            year: termYear,
            month: parseInt(dayMonth.split('/')[1]),
            day: parseInt(dayMonth.split('/')[0]),
          })

          items.push({
            id: AlingsasService.hashCode(item) + date.toMillis(),
            title: item,
            startDate: date.toISO(),
            filterableStartDate: date,
            endDate: date.plus({ days: 1 }).toISO(),
            filterableEndDate: date,
            allDay: true,
          })

          didMatchTerm = true
        }

        let startsDidMatch = false
        const startsMatches = item.match(
          /(?<!hösttermin.*|vårtermin.*)(?<=startar.*)(?<!slutar.*)[0-9]{1,2}\/[0-9]{1,2}/gi
        )
        if (startsMatches) {
          const dayMonth = startsMatches[0]
          const date = DateTime.fromObject({
            year: autumnTermYear,
            month: parseInt(dayMonth.split('/')[1]),
            day: parseInt(dayMonth.split('/')[0]),
          })

          items.push({
            id: AlingsasService.hashCode(item) + date.toMillis(),
            title: item,
            startDate: date.toISO(),
            filterableStartDate: date,
            endDate: date.plus({ days: 1 }).toISO(),
            filterableEndDate: date,
            allDay: true,
          })

          startsDidMatch = true

          const endsMatches = item.match(
            /(?<=slutar.*)[0-9]{1,2}\/[0-9]{1,2}/gi
          )
          if (endsMatches) {
            const dayMonth = endsMatches[0]
            const date = DateTime.fromObject({
              year: springTermYear,
              month: parseInt(dayMonth.split('/')[1]),
              day: parseInt(dayMonth.split('/')[0]),
            })

            items.push({
              id: AlingsasService.hashCode(item) + date.toMillis(),
              title: item,
              startDate: date.toISO(),
              filterableStartDate: date,
              endDate: date.plus({ days: 1 }).toISO(),
              filterableEndDate: date,
              allDay: true,
            })
          }
        }

        let didMatchWeeks = false
        const weeksMatches = item.match(/(?<=veckorna )[0-9]{1,2}-[0-9]{1,2}/gi)
        if (weeksMatches) {
          const weeks = weeksMatches[0].split('-')
          const yearMatches = item.match(/[0-9]{4}/g)

          if (yearMatches) {
            for (const yearMatch of yearMatches) {
              const startDate = DateTime.fromObject({
                weekYear: parseInt(yearMatch),
                weekNumber: parseInt(weeks[0]),
                weekday: 1,
              })
              const endDate = DateTime.fromObject({
                weekYear: parseInt(yearMatch),
                weekNumber: parseInt(weeks[1]),
                weekday: 7,
              })

              items.push({
                id: AlingsasService.hashCode(item) + startDate.toMillis(),
                title: item,
                startDate: startDate.toISO(),
                filterableStartDate: startDate,
                endDate: endDate.toISO(),
                filterableEndDate: endDate,
                allDay: true,
              })
            }

            didMatchWeeks = true
          }
        }

        let yearDayMonthDidMatch = false
        const yearDayMonthMatches = item.match(
          /(?<=\n)[0-9]{4}(?=:)|(?<=\n[0-9]{4}:.*)[0-9]{1,2}\/[0-9]{1,2}/g
        )
        if (yearDayMonthMatches) {
          let year = 0
          for (const yearDayMonthMatch of yearDayMonthMatches) {
            if (yearDayMonthMatch.indexOf('/') === -1) {
              year = parseInt(yearDayMonthMatch)
            } else if (year > 0) {
              const date = DateTime.fromObject({
                year: year,
                month: parseInt(yearDayMonthMatch.split('/')[1]),
                day: parseInt(yearDayMonthMatch.split('/')[0]),
              })
              const title = item.replace(/\n/g, ' ').replace(/\s\s+/g, ' ')

              items.push({
                id: AlingsasService.hashCode(item) + date.toMillis(),
                title: title,
                startDate: date.toISO(),
                filterableStartDate: date,
                endDate: date.plus({ days: 1 }).toISO(),
                filterableEndDate: date,
                allDay: true,
              })

              yearDayMonthDidMatch = true
            }
          }
        }

        let underTheYearDidMatch = false
        const underTheYearMatches = item.match(
          /under\s[ÅÄÖåäö|\w]*\s[0-9]{4}/gi
        )
        if (underTheYearMatches) {
          const firstUnderMatch = underTheYearMatches[0]
          const itemSplitByFirstUnderMatch = item.split(firstUnderMatch)

          const beforeFirstUnder = itemSplitByFirstUnderMatch[0]
          const beforeDayMonthsMatches = beforeFirstUnder.match(
            /[0-9]{1,2}\/[0-9]{1,2}/g
          )
          const firstUnderMatchYearMatches = firstUnderMatch.match(/[0-9]{4}/g)
          const beforeYear = parseInt((firstUnderMatchYearMatches || [])[0])
          for (const beforeDayMonthsMatch of beforeDayMonthsMatches || []) {
            const date = DateTime.fromObject({
              year: beforeYear,
              month: parseInt(beforeDayMonthsMatch.split('/')[1]),
              day: parseInt(beforeDayMonthsMatch.split('/')[0]),
            })

            items.push({
              id: AlingsasService.hashCode(item) + date.toMillis(),
              title: item,
              startDate: date.toISO(),
              filterableStartDate: date,
              endDate: date.plus({ days: 1 }).toISO(),
              filterableEndDate: date,
              allDay: true,
            })

            underTheYearDidMatch = true
          }

          const afterFirstUnder = itemSplitByFirstUnderMatch[1]
          const afterDayMonthsMatches = afterFirstUnder.match(
            /[0-9]{1,2}\/[0-9]{1,2}/g
          )
          const afterFirstUnderYearMatches = afterFirstUnder.match(/[0-9]{4}/g)
          const afterYear = parseInt((afterFirstUnderYearMatches || [])[0])
          for (const afterDayMonthsMatch of afterDayMonthsMatches || []) {
            const date = DateTime.fromObject({
              year: afterYear,
              month: parseInt(afterDayMonthsMatch.split('/')[1]),
              day: parseInt(afterDayMonthsMatch.split('/')[0]),
            })

            items.push({
              id: AlingsasService.hashCode(item) + date.toMillis(),
              title: item,
              startDate: date.toISO(),
              filterableStartDate: date,
              endDate: date.plus({ days: 1 }).toISO(),
              filterableEndDate: date,
              allDay: true,
            })

            underTheYearDidMatch = true
          }
        }

        if (
          !didMatchWeek &&
          !didMatchTerm &&
          !startsDidMatch &&
          !didMatchWeeks &&
          !yearDayMonthDidMatch &&
          !underTheYearDidMatch
        ) {
          this.log('Unmatched item: ' + item)
        }
      })

    return items.filter(
      (item) =>
        item.filterableEndDate >= today && item.filterableStartDate < inAYear
    )
  }

  private static hashCode(str: string): number {
    var hash = 0,
      i,
      chr
    if (str.length === 0) return hash
    for (i = 0; i < str.length; i++) {
      chr = str.charCodeAt(i)
      hash = (hash << 5) - hash + chr
      hash |= 0 // Convert to 32bit integer
    }
    return hash
  }
}
