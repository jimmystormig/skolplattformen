import * as html from 'node-html-parser'
import { decode } from 'he'
import { EtjanstChild, Notification } from '@skolplattformen/api';

export function scrapeChildUrl(body: string, child: EtjanstChild): string | undefined {

    const doc = html.parse(body);
    return doc
        .querySelectorAll('.card.principalcard .card-body')
        .find(cardBody => cardBody.querySelector('.principalcard__name').rawText === child.name)
        ?.getAttribute('href');
}

export function scrapeClassUrls(body: string): ({ href: string, name: string })[] {
    const doc = html.parse(body);
    return doc
        .querySelectorAll('.row.relations .card.principalcard .card-body')
        .map(cardBody => {
            return {
                href: cardBody.getAttribute('href') as string,
                name: cardBody.getAttribute('data-testid') as string
            }
        })
        .filter(c => c.name.match(/^[A-Z]{3}[0-9]{2}[A-Z|a-z|Å|å|Ä|ä|Ö|ö]*$/) !== null);
}

export function scrapeClassPeople(body: string, type: 'elever' | 'lärare', className: string): ({ firstname: string, lastname: string, className: string})[] {
    const doc = html.parse(body);
    return doc
        .querySelectorAll('.panel.panel-borderless')
        .filter(panel => panel.querySelector('.panel-title').rawText.trim().toLowerCase().startsWith(type))
        .map(panel => panel.querySelectorAll('.card.principalcard .principalcard__name').map(name => name.rawText))
        .flat()
        .sort()
        .map(name => {
            return {
                firstname: name.substring(0, name.indexOf(' ')),
                lastname: name.substring(name.indexOf(' ') + 1),
                className: className
            }
        });
}

export function scrapeNotificationsGuardianId(body: string, child: EtjanstChild): string {
    const doc = html.parse(body);
    return doc
        .querySelectorAll('#notifications_guardian_guardian .notification-container .collapsable-header')
        .find(container =>  container.querySelector('h3').childNodes[2].rawText.replace('\n', '').trim() === child.name)
        ?.getAttribute('data-target')
        ?.replace('#notifications_guardian_', '') as string;
}

export function scrapeNotifications(body: string, baseUrl: string): Notification[] {
    const doc = html.parse(decode('<html><head></head><body>' + body + '</body></html>'));
    const anchors = doc.querySelectorAll('div.notification');

    return anchors
        .map(notification => {
            const anchor = (notification.childNodes[3] as any) as HTMLElement;
            const href = anchor.getAttribute('href') as string;
            const message = (anchor.childNodes[2] as any)?.rawText.replace(/(?:\r\n|\r|\n)/g, '').replace(/\s\s+/g, ' ').trim();
            const date = anchor.querySelector('.meta .jq-notification-date')?.getAttribute('data-date') as string;

            return {
                id: href,
                category: null,
                message: message,
                dateCreated: date,
                dateModified: date,
                sender: 'Unikum',
                type: 'notification',
                url: baseUrl + href
            }
        })
        .filter(notification => notification.id !== undefined);
}


