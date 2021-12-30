import * as html from 'node-html-parser'
import { decode } from 'he'
import { EtjanstChild, NewsItem } from '@skolplattformen/api'
import { DateTime } from "luxon"

export function scrapeNews(body: string, child: EtjanstChild): NewsItem[] {
    const doc = html.parse(decode(body));

    const childNews = doc.querySelectorAll('.children .child .child-block')
    .filter(block => block.querySelector('h2')?.rawText === child.name);

    const linksOfLinks = childNews
        .map(block => block.querySelectorAll('ul.arena-guardian-child-info li.news-and-infoblock-item a'));

    const news: NewsItem[] = [];

    linksOfLinks.forEach(links => {
        links.forEach(link => {
            const viewed = link.classNames.indexOf('node-viewed') > -1 ? '◉ ' : '◎ ';
            news.push({
                id: link.getAttribute('href') as string,
                header: viewed + link.text,
                published: ''
            })
        });
    });


    return news;
}

export function scrapeNewsDetail(body: string): NewsItem{
    const doc = html.parse(decode(body));

    const newsBlock = doc.querySelector('.node-news');

    // TODO Add attached files to body

    // Date is in format '21 dec 2021'
    var rawDate = newsBlock.querySelector('.submitted .date-display-single')?.rawText;
    var date = DateTime.fromFormat(rawDate, 'dd MMM yyyy', { locale: 'sv' });

    return {
        id: '',
        header: newsBlock.querySelector('h1 span')?.rawText,
        intro: newsBlock.querySelector('.field-name-field-introduction .field-item')?.rawText,
        body: newsBlock.querySelector('.field-name-body .field-item')?.rawText,
        author: newsBlock.querySelector('.submitted .username')?.rawText,
        published: date.toISODate(),
    };
}