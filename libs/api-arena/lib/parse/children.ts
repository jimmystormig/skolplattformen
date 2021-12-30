import * as html from 'node-html-parser'
import { decode } from 'he'
import { EtjanstChild } from '@skolplattformen/api'

export function scrapeChildren(body: string): EtjanstChild[] {
    const doc = html.parse(decode(body));

    const childNames = doc.querySelectorAll('.children .child .child-block h2').map(h2 => h2.rawText);

    return childNames.map(childName => {
        return {
            id: childName.toLowerCase().replace(/\s/g, '-'),
            name: childName,
            sdsId: '',
        }
    });
}