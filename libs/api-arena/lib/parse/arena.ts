import * as html from 'node-html-parser'
import { decode } from 'he'

export function getArenaAsCustodianUrl(body: string, baseUrl: string): string | undefined {
    const doc = html.parse(decode(body));
    const anchor = doc.querySelector('a[href="/arena/guardian/masquerade-as-custodian"]')
    if (anchor) {
        return baseUrl + anchor.getAttribute('href');
    }

    return undefined;
}