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
            const viewed = link.classNames.indexOf('node-viewed') > -1 ? '' : '◉ ';
            news.push({
                id: link.getAttribute('href') as string,
                header: viewed + link.text,
                published: ''
            })
        });
    });


    return news;
}

export function scrapeNewsDetail(body: string, item: NewsItem){
    const doc = html.parse(decode(body));
    const newsBlock = doc.querySelector('.node-news');
    var rawDate = newsBlock.querySelector('.submitted .date-display-single')?.rawText;
    var date = DateTime.fromFormat(rawDate, 'dd MMM yyyy', { locale: 'sv' });
    var imageUrl = newsBlock.querySelector('.field-name-field-image img')?.getAttribute('src');
    var header = newsBlock.querySelector('h1 span')?.rawText;
    var intro = newsBlock.querySelector('.field-name-field-introduction .field-item')?.rawText;
    var body = newsBlock.querySelector('.field-name-body .field-item')?.rawText;
    var attached = newsBlock.querySelectorAll('.field-name-field-attached-files .field-item a')
        .map(a => {
            return {
                url: a.getAttribute('href'),
                name: a.rawText
            }
        })
        .reduce<string>((i, el) => {
            return i + '[' + el.name + '](' + el.url + ')  \n'
        }, '');

    body = (body ? body + '\n\n' : '') + intro + (body || intro ? '\n\n' : '') + attached;

    item.header = header;
    item.intro = intro;
    item.body = body;
    item.author = newsBlock.querySelector('.submitted .username')?.rawText;
    item.published = date.toISODate();
    item.fullImageUrl = imageUrl;
}