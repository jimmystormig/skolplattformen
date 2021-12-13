import {
    Api, CalendarItem, Classmate, CookieManager, EtjanstChild, Fetch, Fetcher, FetcherOptions, LoginStatusChecker, MenuItem, NewsItem, Notification, ScheduleItem, SchoolContact, Skola24Child, Teacher, TimetableEntry, User, wrap
  } from '@skolplattformen/api'

import EventEmitter from "events";
import { DateTime } from 'luxon';

export class ApiArena extends EventEmitter implements Api {
  private fetch: Fetcher
  private realFetcher: Fetcher
  private cookieManager: CookieManager
  isFake = false;
  isLoggedIn = false;

  constructor(
    fetch: Fetch,
    cookieManager: CookieManager,
    options?: FetcherOptions
  ) {
    super()
    this.fetch = wrap(fetch, options)
    this.realFetcher = this.fetch
    this.cookieManager = cookieManager
  }

  getPersonalNumber(): string | undefined {
    throw new Error('Method not implemented.');
  }
  login(personalNumber?: string): Promise<LoginStatusChecker> {
    throw new Error('Method not implemented.');
  }
  setSessionCookie(sessionCookie: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getSessionHeaders(url: string): Promise<{ [index: string]: string; }> {
    throw new Error('Method not implemented.');
  }
  getUser(): Promise<User> {
    throw new Error('Method not implemented.');
  }
  getChildren(): Promise<EtjanstChild[]> {
    throw new Error('Method not implemented.');
  }
  getCalendar(child: EtjanstChild): Promise<CalendarItem[]> {
    throw new Error('Method not implemented.');
  }
  getClassmates(child: EtjanstChild): Promise<Classmate[]> {
    throw new Error('Method not implemented.');
  }
  getNews(child: EtjanstChild): Promise<NewsItem[]> {
    throw new Error('Method not implemented.');
  }
  getNewsDetails(child: EtjanstChild, item: NewsItem): Promise<any> {
    throw new Error('Method not implemented.');
  }
  getMenu(child: EtjanstChild): Promise<MenuItem[]> {
    throw new Error('Method not implemented.');
  }
  getNotifications(child: EtjanstChild): Promise<Notification[]> {
    throw new Error('Method not implemented.');
  }
  getTeachers(child: EtjanstChild): Promise<Teacher[]> {
    throw new Error('Method not implemented.');
  }
  getSchedule(child: EtjanstChild, from: DateTime, to: DateTime): Promise<ScheduleItem[]> {
    throw new Error('Method not implemented.');
  }
  getSchoolContacts(child: EtjanstChild): Promise<SchoolContact[]> {
    throw new Error('Method not implemented.');
  }
  getSkola24Children(): Promise<Skola24Child[]> {
    throw new Error('Method not implemented.');
  }
  getTimetable(child: Skola24Child, week: number, year: number, lang: string): Promise<TimetableEntry[]> {
    throw new Error('Method not implemented.');
  }
  logout(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}