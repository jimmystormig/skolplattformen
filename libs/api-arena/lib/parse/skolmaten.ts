import * as html from 'node-html-parser'
import { decode } from 'he'
import { MenuItem } from "@skolplattformen/api";

export function scrapeMenus(body: string): MenuItem[] {
    const doc = html.parse(decode(body));
    const weekDiv = doc.querySelector('#weeks .week')
    const week = weekDiv.getAttribute('data-week-of-year');
    const menus = weekDiv.querySelectorAll('.row .items p span').map(item => item.rawText);

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

    return menuItemsFS;
}