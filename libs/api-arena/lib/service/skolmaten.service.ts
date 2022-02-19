import * as html from 'node-html-parser'
import { decode } from 'he'
import { EtjanstChild, Fetcher, MenuItem } from '@skolplattformen/api'
import { IService } from './service.interface'

export class SkolmatenService implements IService {
  log: (...data: any[]) => void = () => {}
  private fetch: Fetcher
  private routes = {
    skolmaten: (schoolID: string) => `https://skolmaten.se/${schoolID}/`,
  }

  constructor(fetch: Fetcher, log: (...data: any[]) => void) {
    this.fetch = fetch
    this.log = (...data) => log('[skolmaten-service]', ...data)
  }

  setFetcher(fetcher: Fetcher): void {
    this.fetch = fetcher
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

    const url = this.routes.skolmaten(schoolId as string)
    const response = await this.fetch('skolmaten', url)

    if (response.status === 404) {
      return []
    }

    const responseText = await response.text()

    const doc = html.parse(decode(responseText))
    const weekDiv = doc.querySelector('#weeks .week')
    const week = weekDiv.getAttribute('data-week-of-year')
    const menus = weekDiv
      .querySelectorAll('.row .items p span')
      .map((item) => item.rawText)

    const menuItemsFS = [
      {
        title: `Måndag - Vecka ${week}`,
        description: menus[0] || '',
      },
      {
        title: `Tisdag - Vecka ${week}`,
        description: menus[1] || '',
      },
      {
        title: `Onsdag - Vecka ${week}`,
        description: menus[2] || '',
      },
      {
        title: `Torsdag - Vecka ${week}`,
        description: menus[3] || '',
      },
      {
        title: `Fredag - Vecka ${week}`,
        description: menus[4] || '',
      },
    ]

    return menuItemsFS
  }
}
