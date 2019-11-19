import { toBech32Address } from './zns/utils';

import { ResolutionError } from './index';
import NamingService from './namingService';
import { NamicornResolution, NullAddress, SourceDefinition } from './types';
import Zns from './zns';
import Ens from './ens';
// import * as pckg from '../package.json';

const DefaultUrl = 'https://unstoppabledomains.com/api/v1';

export default class Udapi extends NamingService {
  private url: string;
  private headers: {
    [key: string]: string;
  };

  constructor() {
    super();
    this.url = DefaultUrl;

    const DefaultUserAgent = this.isNode()
      ? 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)'
      : navigator.userAgent;
    const version = process.env.npm_package_version;
    const CustomUserAgent = `${DefaultUserAgent} namicorn/${version}`;
    this.headers = { 'X-user-agent': CustomUserAgent };
  }

  /** @internal */
  isSupportedDomain(domain: string): boolean {
    return !!this.findMethod(domain);
  }

  /** @internal */
  isSupportedNetwork(): boolean {
    return true;
  }
  /** @internal */
  namehash(domain: string): string {
    const method = this.findMethod(domain);
    if (!method) throw new ResolutionError('UnsupportedDomain', { domain });
    return method.namehash(domain);
  }

  /**
   * Resolves the domain via UD API mirror
   * @param domain - domain name to be resolved
   * @param currencyTicker - currencyTicker such as
   *  - ZIL
   *  - BTC
   *  - ETH
   */
  async address(domain: string, currencyTicker: string): Promise<string> {
    const data = await this.resolve(domain);
    if (!data.meta.owner || data.meta.owner === NullAddress)
      throw new ResolutionError('UnregisteredDomain', { domain });
    const address = data.addresses[currencyTicker.toUpperCase()];
    if (!address)
      throw new ResolutionError('UnspecifiedCurrency', {
        domain,
        currencyTicker,
      });
    return address;
  }

  /**
   * Owner of the domain
   * @param domain - domain name
   * @returns An owner address of the domain
   */
  async owner(domain: string): Promise<string | null> {
    const { owner } = (await this.resolve(domain)).meta;
    if (!owner) return null;
    return owner.startsWith('zil1') ? owner : toBech32Address(owner);
  }

  /**
   * Resolves the domain name via UD API mirror
   * @param domain - domain name to be resolved
   */
  async resolve(domain: string): Promise<NamicornResolution> {
    try {
      const response = await this.fetch(`${this.url}/${domain}`, {
        method: 'GET',
        headers: this.headers,
      });
      return await response.json();
    } catch (error) {
      if (error.name !== 'FetchError') throw error;
      throw new ResolutionError('NamingServiceDown', { method: 'UD' });
    }
  }

  /** @internal */
  protected normalizeSource(
    source: string | boolean | import('./types').SourceDefinition,
  ): SourceDefinition {
    throw new Error('Method not implemented.');
  }

  private findMethod(domain: string) {
    return [new Zns(), new Ens()].find(m => m.isSupportedDomain(domain));
  }

  private findMethodOrThrow(domain: string) {
    const method = this.findMethod(domain);
    if (!method) throw new ResolutionError('UnsupportedDomain', { domain });
    return method;
  }
  
  /**
   * Looks up for an arbitrary key inside the records of certain domain
   * @param domain - domain name
   * @param key - key to look for
   */
  async record(domain: string, key: string): Promise<string> {
    return await this.findMethodOrThrow(domain).record(domain, key);
  }
}