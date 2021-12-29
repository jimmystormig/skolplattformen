import * as html from 'node-html-parser'
import { decode } from 'he'
import { User } from '@skolplattformen/api'

export function scrapeUser(body: string): User {
    const doc = html.parse(decode(body));
    console.log('scrapeUser title', doc.querySelector('head title').rawText);

    const firstName = doc.querySelector('.field-name-field-firstname .field-item').rawText;
    const lastName = doc.querySelector('.field-name-field-lastname .field-item').rawText;
    const email = doc.querySelector('.field-name-field-user-email .field-item').rawText;

    return {
        isAuthenticated: true,
        firstName: firstName,
        lastName: lastName,
        email: email,
    };
}