import * as html from 'node-html-parser'
import { decode } from 'he'
import { DateTime } from 'luxon'
import { EtjanstChild, Fetcher, MenuItem } from '@skolplattformen/api'
import { IService } from './service.interface'

export class SodexoService implements IService {
  log: (...data: any[]) => void = () => {}
  private fetch: Fetcher
  private routes = {
    start:
      'https://sodexo.mashie.com/public/app/Alings%C3%A5s%20skolor/e466d251?country=se',
  }

  constructor(fetch: Fetcher, log: (...data: any[]) => void) {
    this.fetch = fetch
    this.log = (...data) => log('[sodexo-service]', ...data)
  }

  setFetcher(fetcher: Fetcher): void {
    this.fetch = fetcher
  }

  async getMenu(child: EtjanstChild): Promise<MenuItem[]> {
    this.log('getMenu')

    const response = await this.fetch('sodexo-start', this.routes.start)

    const responseText = await response.text()

    const doc = html.parse(decode(responseText))
    const nodes = doc.querySelector('div.panel-group').childNodes

    const currentWeek = DateTime.local().weekNumber

    let week = 0
    const menuItems: MenuItem[] = []
    for (const node of nodes) {
      if ((node as any).rawTagName === 'h4') {
        const weekMatches = node.text.match(/\d+/)
        week = weekMatches && weekMatches[0] ? parseInt(weekMatches[0]) : 0
        continue
      }

      if (week !== currentWeek) {
        continue
      }

      if (node.childNodes.length < 4) {
        continue
      }

      const day = node.childNodes[1].childNodes[3]?.text

      if (!day) {
        continue
      }

      let food = ''
      for (const foodPanel of node.childNodes[3].childNodes) {
        if (foodPanel.childNodes.length === 0) {
          continue
        }

        food +=
          (food ? '\n' : '') +
          foodPanel.childNodes[3].text +
          ' - ' +
          foodPanel.childNodes[5].text
      }

      menuItems.push({
        title: `${day} - Vecka ${week}`,
        description: food,
      })
    }

    return menuItems
  }
}
