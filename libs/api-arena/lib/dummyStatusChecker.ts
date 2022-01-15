import { LoginStatusChecker } from '@skolplattformen/api'
import EventEmitter from 'events'

export class DummyStatusChecker
  extends EventEmitter
  implements LoginStatusChecker
{
  token = ''
  async cancel(): Promise<void> {}
  async check(): Promise<void> {}
}
