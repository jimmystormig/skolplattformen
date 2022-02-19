import { Fetcher } from '@skolplattformen/api'

export interface IService {
  setFetcher(fetcher: Fetcher): void
}
