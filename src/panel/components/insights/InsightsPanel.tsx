import { useState, useEffect } from 'react';
import { MessageType } from '../../../shared/types';

type InsightsSubTab = 'overview' | 'network' | 'security' | 'performance' | 'seo' | 'social' | 'raw';

interface ProviderInfo {
  asNumber: number;
  organization: string;
  domain: string;
  country: string;
  isEU: boolean;
}

interface LocationInfo {
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  isEU: boolean;
}

interface HostingRecord {
  address: string;
  isIPv6: boolean;
  provider: ProviderInfo | null;
  location: LocationInfo | null;
}

interface NameserverRecord {
  domain: string;
  lookups: HostingRecord[];
}

interface DomainInfo {
  url: string;
  hostname: string;
  dns: any[];
  whois: any;
  ssl: {
    dns_table?: any[];
    chain_table?: any[];
    general_table: any[];
    report_table: any[];
    handshake: string;
  } | null;
  headers: Record<string, string>;
  performance: any;
  metadata: Record<string, string>;
  infrastructure: {
    hosting: HostingRecord[];
    nameservers: NameserverRecord[];
    mailServers: { incoming: NameserverRecord[]; outgoing: NameserverRecord[] };
  };
}

export default function InsightsPanel() {
  const [activeTab, setActiveTab] = useState<InsightsSubTab>('overview');
  const [data, setData] = useState<DomainInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetHostname, setTargetHostname] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get active tab URL
      const tabInfo: any = await chrome.runtime.sendMessage({ type: MessageType.GET_ACTIVE_TAB_URL });
      if (!tabInfo?.url) throw new Error('Could not get tab URL');

      const url = new URL(tabInfo.url);
      const hostname = url.hostname;
      setTargetHostname(hostname);

      // 2. Fetch DNS records (A, MX, NS)
      const dnsPromise = fetchDNS(hostname);
      
      // 3. Fetch Domain Info (WHOIS/RDAP)
      const whoisPromise = fetchWHOIS(hostname);

      // 5. Fetch HTTP Headers (via proxy to avoid CORS)
      const headersPromise = chrome.runtime.sendMessage({
        type: MessageType.FETCH_URL,
        payload: { url: tabInfo.url, options: { method: 'HEAD' } }
      });

      // 6. Infrastructure from Hosting Checker
      const infraPromise = fetchInfrastructure(hostname);

      const [dns, whoisResp, headersResp, metadataResp, perfResp, infraData] = await Promise.all([
        dnsPromise, 
        whoisPromise, 
        headersPromise,
        chrome.runtime.sendMessage({ type: MessageType.GET_PAGE_METADATA }),
        chrome.runtime.sendMessage({ type: MessageType.GET_DETAILED_PERF }),
        infraPromise
      ]);

      const headers = headersResp?.headers || {};
      const ssl = await fetchSSLData(hostname);

      setData({
        url: tabInfo.url,
        hostname,
        dns: dns || [],
        whois: whoisResp || {},
        ssl,
        headers,
        performance: perfResp?.payload || {},
        metadata: metadataResp?.payload || {},
        infrastructure: infraData
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInfrastructure = async (hostname: string) => {
    try {
      const resp = await chrome.runtime.sendMessage({
        type: MessageType.FETCH_URL,
        payload: { url: `https://hosting-checker.net/api/hosting/${hostname}` }
      });

      if (resp?.ok && resp?.data) {
        const d = resp.data;
        return {
          hosting: d.web?.lookups || [],
          nameservers: d.nameserver?.lookups || [],
          mailServers: {
            incoming: d.incomingMail?.lookups || [],
            outgoing: d.outgoingMail?.lookups || []
          }
        };
      }
    } catch (e) {
      console.error('Error fetching hosting checker data', e);
    }

    // Fallback if API fails
    return { hosting: [], nameservers: [], mailServers: { incoming: [], outgoing: [] } };
  };

  const fetchSSLData = async (hostname: string) => {
    try {
      const resp = await chrome.runtime.sendMessage({
        type: MessageType.FETCH_URL,
        payload: {
          url: 'https://decoder.link/api',
          options: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method: 'sslchecker',
              params: { hostname, port: '443' }
            })
          }
        }
      });

      if (resp?.ok && resp?.data && (resp.data.general_table || resp.data.chain_table)) {
        return {
          dns_table: resp.data.dns_table || [],
          chain_table: resp.data.chain_table || [],
          general_table: resp.data.general_table || [],
          report_table: resp.data.report_table || [],
          handshake: resp.data.handshake || ''
        };
      }
    } catch (e) {
      console.error('Error fetching decoder.link data', e);
    }
    return null;
  };

  const fetchDNS = async (hostname: string) => {
    try {
      const types = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'SOA'];
      
      // 1. Try whatsmydns.net
      try {
        const results = await Promise.all(types.map(type => 
          chrome.runtime.sendMessage({
            type: MessageType.FETCH_URL,
            payload: { url: `https://www.whatsmydns.net/api/search?server=17&type=${type}&query=${hostname}` }
          })
        ));
        
        // If the first request returns valid JSON array with length, whatsmydns succeeded
        if (results[0]?.data && Array.isArray(results[0].data.data) && results[0].data.data.length > 0) {
          return results.map((r, i) => ({ type: types[i], data: r.data?.data?.map((d: any) => ({ data: d })) || [] }));
        }
      } catch (e) {
        console.log('whatsmydns failed/blocked, falling back to Google DNS', e);
      }

      // 2. Fallback to Google DNS
      const results = await Promise.all(types.map(type => 
        chrome.runtime.sendMessage({
          type: MessageType.FETCH_URL,
          payload: { url: `https://dns.google/resolve?name=${hostname}&type=${type}` }
        })
      ));
      return results.map((r, i) => ({ type: types[i], data: r.data?.Answer || [] }));
    } catch { return []; }
  };

  const fetchWHOIS = async (hostname: string) => {
    const parts = hostname.split('.');
    const apex = parts.slice(-2).join('.');
    
    // RDAP servers have strict rate limits. Try rdap.org (redirector) then rdap.net
    const sources = [
      `https://rdap.org/domain/${apex}`,
      `https://rdap.net/domain/${apex}`,
      `https://rdap-bootstrap.arin.net/bootstrap/domain/${apex}`
    ];

    for (const url of sources) {
      try {
        const resp: any = await chrome.runtime.sendMessage({
          type: MessageType.FETCH_URL,
          payload: { url }
        });
        if (resp.ok && resp.data && !resp.error) return resp.data;
      } catch { continue; }
    }
    return {};
  };

  if (loading) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="loading-spinner" style={{ marginBottom: 12 }}></div>
        <div className="empty-title">Analyzing Domain...</div>
        <div className="empty-desc">Fetching DNS, WHOIS, and technology insights{targetHostname ? ` for ${targetHostname}` : ''}.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon" style={{ color: 'var(--brand-danger)' }}>⚠</div>
        <div className="empty-title">Analysis Failed</div>
        <div className="empty-desc">{error}</div>
        <button className="btn btn-primary" onClick={fetchData} style={{ marginTop: 12 }}>Retry</button>
      </div>
    );
  }

  return (
    <div className="insights-panel animate-fade-in">
      {/* Sub-tabs */}
      <div className="inspector-sub-tabs" style={{ marginBottom: 16 }}>
        {([
          { id: 'overview', label: 'Overview' },
          { id: 'network', label: 'Network' },
          { id: 'security', label: 'Security' },
          { id: 'performance', label: 'Perf' },
          { id: 'seo', label: 'SEO' },
          { id: 'social', label: 'Social' },
          { id: 'raw', label: 'Raw' }
        ] as const).map(tab => (
          <button
            key={tab.id}
            className={`inspector-sub-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as InsightsSubTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="insights-content">
        {activeTab === 'overview' && <OverviewSection data={data!} />}
        {activeTab === 'network' && <NetworkSection data={data!} />}
        {activeTab === 'security' && <SecuritySection data={data!} />}
        {activeTab === 'performance' && <PerformanceSection data={data!} />}
        {activeTab === 'seo' && <SEOSection data={data!} />}
        {activeTab === 'social' && <SocialSection data={data!} />}
        {activeTab === 'raw' && <RawSection data={data!} />}
      </div>
    </div>
  );
}

function OverviewSection({ data }: { data: DomainInfo }) {
  const whois = data.whois;
  const events = whois.events || [];
  const created = events.find((e: any) => e.eventAction === 'registration')?.eventDate;
  const expires = events.find((e: any) => e.eventAction === 'expiration')?.eventDate;

  return (
    <div className="animate-fade-in">
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <span className="card-title">Domain Identity</span>
        </div>
        <div className="prop-row">
          <span className="prop-name">Hostname</span>
          <span className="prop-value">{data.hostname}</span>
        </div>
        <div className="prop-row">
          <span className="prop-name">Registrar</span>
          <span className="prop-value">{whois.port43 || 'Unknown'}</span>
        </div>
        {created && (
          <div className="prop-row">
            <span className="prop-name">Registered</span>
            <span className="prop-value">{new Date(created).toLocaleDateString()}</span>
          </div>
        )}
        {expires && (
          <div className="prop-row">
            <span className="prop-name">Expires</span>
            <span className="prop-value">{new Date(expires).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Hosting & Infrastructure</span>
        </div>
        <div className="prop-row">
          <span className="prop-name">IP Address</span>
          <span className="prop-value">{data.dns.find(d => d.type === 'A')?.data[0]?.data || 'Unknown'}</span>
        </div>
        <div className="prop-row">
          <span className="prop-name">Server</span>
          <span className="prop-value">{data.headers['server'] || 'Unknown'}</span>
        </div>
        <div className="prop-row">
          <span className="prop-name">Powered By</span>
          <span className="prop-value">{data.headers['x-powered-by'] || 'N/A'}</span>
        </div>
      </div>
    </div>
  );
}

function NetworkSection({ data }: { data: DomainInfo }) {
  const infra = data.infrastructure;
  const dnsRecords = data.dns;

  return (
    <div className="animate-fade-in">
      {/* Web Hosting Details */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Web Hosting Details</span>
        </div>
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="insights-table">
            <thead>
              <tr>
                <th>IP Address</th>
                <th>Provider</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {infra.hosting.map((ip, i) => (
                <tr key={i}>
                  <td style={{ verticalAlign: 'top' }} title={ip.address}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontWeight: 500 }}>{ip.address}</span>
                      {ip.isIPv6 && <div><span className="badge-small" style={{ fontSize: 9, padding: '1px 4px' }}>IPv6</span></div>}
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'top' }} title={`${ip.provider?.asNumber ? `AS${ip.provider.asNumber} ` : ''}${ip.provider?.organization || 'Unknown'} ${ip.provider?.domain ? `(${ip.provider.domain})` : ''}`}>
                    <div className="provider-cell">
                      <span className="provider-name" style={{ fontWeight: 600 }}>
                        {ip.provider?.asNumber ? `AS${ip.provider.asNumber} ` : ''}
                        {ip.provider?.organization || 'Unknown'}
                      </span>
                      <span className="provider-domain">{ip.provider?.domain ? `(${ip.provider.domain})` : ''}</span>
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'top' }} title={ip.location ? `${ip.location.city}, ${ip.location.country}` : 'Unknown'}>{ip.location ? `${ip.location.city}, ${ip.location.country}` : 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nameservers */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Nameserver Details</span>
        </div>
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="insights-table">
            <thead>
              <tr>
                <th>Nameserver</th>
                <th>IP / Provider / Location</th>
              </tr>
            </thead>
            <tbody>
              {infra.nameservers.map((ns, i) => (
                <tr key={i}>
                  <td style={{ verticalAlign: 'top', fontWeight: 600 }} title={ns.domain}>{ns.domain}</td>
                  <td>
                    {ns.lookups.map((ip, j) => (
                      <div key={j} className="ip-stacked-row" title={`${ip.address} - ${ip.provider?.organization || 'Unknown'} - ${ip.location ? `${ip.location.city}, ${ip.location.country}` : 'Unknown'}`}>
                        <span className="ip-val" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {ip.address}
                          {ip.isIPv6 && <span className="badge-small" style={{ fontSize: 9, padding: '1px 4px' }}>IPv6</span>}
                        </span>
                        <span className="ip-sub" style={{ lineHeight: 1.4 }}>
                          {ip.provider?.asNumber ? `AS${ip.provider.asNumber} ` : ''}
                          <strong>{ip.provider?.organization || 'Unknown'}</strong>
                          {ip.provider?.domain ? ` (${ip.provider.domain})` : ''} • 
                          {ip.location ? ` ${ip.location.city}, ${ip.location.country}` : ' Unknown'}
                        </span>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mail Servers */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Incoming Mail Servers (MX)</span>
        </div>
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="insights-table">
            <thead>
              <tr>
                <th>Server</th>
                <th>IP / Provider / Location</th>
              </tr>
            </thead>
            <tbody>
              {infra.mailServers.incoming.map((mx, i) => (
                <tr key={i}>
                  <td style={{ verticalAlign: 'top', fontWeight: 600 }} title={mx.domain}>{mx.domain}</td>
                  <td>
                    {mx.lookups.map((ip, j) => (
                      <div key={j} className="ip-stacked-row" title={`${ip.address} - ${ip.provider?.organization || 'Unknown'} - ${ip.location ? `${ip.location.city}, ${ip.location.country}` : 'Unknown'}`}>
                        <span className="ip-val" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {ip.address}
                          {ip.isIPv6 && <span className="badge-small" style={{ fontSize: 9, padding: '1px 4px' }}>IPv6</span>}
                        </span>
                        <span className="ip-sub" style={{ lineHeight: 1.4 }}>
                          {ip.provider?.asNumber ? `AS${ip.provider.asNumber} ` : ''}
                          <strong>{ip.provider?.organization || 'Unknown'}</strong>
                          {ip.provider?.domain ? ` (${ip.provider.domain})` : ''} • 
                          {ip.location ? ` ${ip.location.city}, ${ip.location.country}` : ' Unknown'}
                        </span>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DNS Information Grouped */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">DNS Record Groups</span>
        </div>
        {dnsRecords.map(d => (
          <div key={d.type} style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="dns-type-badge">{d.type}</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>{d.data.length} Records</span>
            </div>
            {d.data.map((entry: any, i: number) => (
              <div key={i} className="dns-record-row">
                <div className="record-content" title={entry.data}>{entry.data}</div>
                <div className="record-ttl" title={`TTL: ${entry.TTL || entry.ttl || 'N/A'}`}>TTL: {entry.TTL || entry.ttl || 'N/A'}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SecuritySection({ data }: { data: DomainInfo }) {
  const ssl = data.ssl;
  if (!ssl) return <div className="empty-desc">No SSL data available.</div>;

  const { dns_table, chain_table, general_table, report_table, handshake } = ssl;

  return (
    <div className="animate-fade-in">
      {/* Security Report Scorecard */}
      {report_table && report_table.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Security Report</span>
          </div>
          {report_table.map((row: any[], i: number) => {
            const isError = row[0]; // The API uses true/false for error indicator
            const key = row[1];
            const val = row[2];
            return (
              <div className="prop-row" key={i} title={`${key.replace(':', '')}: ${val}`}>
                <span className="prop-name">{key.replace(':', '')}</span>
                <span className="prop-value" style={{ color: isError ? 'var(--brand-danger)' : 'var(--brand-success)' }}>
                  {isError ? '✕ ' : '✓ '} {val}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* SSL DNS Resolution */}
      {dns_table && dns_table.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">SSL DNS Resolution</span>
          </div>
          {dns_table.map((row: any[], i: number) => (
            <div className="prop-row" key={i} title={row[1]}>
              <span className="prop-name">{row[0].replace(':', '')}</span>
              <span className="prop-value">{row[1]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Certificate Chain */}
      {chain_table && chain_table.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Certificate Chain</span>
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {chain_table.map((cert: any[], i: number) => {
              const depth = cert[0];
              const subject = cert[1];
              const issuer = cert[2];
              const issuerOrg = cert[3];
              const props = cert[5] || [];
              return (
                <div key={i} style={{ 
                  background: 'var(--bg-hover)', 
                  padding: 12, 
                  borderRadius: 'var(--radius-md)', 
                  borderLeft: `3px solid var(--brand-primary)`
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--text-primary)' }}>
                    {depth === 1 ? 'End-Entity Certificate' : `Intermediate/Root CA (Depth ${depth})`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.4 }}>
                    <strong>Subject:</strong> {subject}<br/>
                    <strong>Issuer:</strong> {issuer} ({issuerOrg})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {props.map((p: any[], j: number) => (
                      <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{p[0].replace(':', '')}</span>
                        <span style={{ 
                          color: p[2] ? 'var(--brand-success)' : 'var(--text-primary)',
                          fontWeight: p[2] ? 600 : 400,
                          textAlign: 'right',
                          maxWidth: '70%',
                          wordBreak: 'break-all'
                        }}>
                          {p[1]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Certificate Summary */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">General Information</span>
        </div>
        {general_table.map((row: any[], i: number) => {
          const key = row[0];
          const val = Array.isArray(row[1]) ? row[1].join(', ') : row[1];
          const highlight = row[2]; // e.g., true for green highlight
          return (
            <div className="prop-row" key={i} title={val}>
              <span className="prop-name">{key.replace(':', '')}</span>
              <span className="prop-value" style={highlight ? { color: 'var(--brand-success)', fontWeight: 700 } : {}}>
                {val}
              </span>
            </div>
          );
        })}
      </div>

      {/* Handshake Data */}
      {handshake && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Raw SSL Handshake</span>
          </div>
          <pre style={{ 
            background: 'var(--bg-hover)', 
            padding: 12, 
            borderRadius: 'var(--radius-md)', 
            fontSize: 10,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            color: 'var(--text-secondary)'
          }}>
            {handshake}
          </pre>
        </div>
      )}
    </div>
  );
}

function SEOSection({ data }: { data: DomainInfo }) {
  const meta = data.metadata;
  const title = meta['title'] || '';
  const description = meta['description'] || '';
  const canonical = meta['canonical'] || '';
  const viewport = meta['viewport'] || '';
  const charset = meta['charset'] || '';
  const lang = meta['lang'] || '';
  const favicon = meta['favicon'] || '';
  const robots = meta['robots'] || '';
  const xRobotsTag = data.headers?.['x-robots-tag'] || '';
  const appleTouchIcon = meta['apple-touch-icon'] || '';

  type CheckStatus = 'pass' | 'warn' | 'fail';
  interface SEOCheck { label: string; status: CheckStatus; value: string; tip?: string }

  const titleLen = title.length;
  const descLen = description.length;

  const checks: SEOCheck[] = [
    { label: 'Page Title', status: titleLen === 0 ? 'fail' : (titleLen < 30 || titleLen > 60) ? 'warn' : 'pass', value: titleLen === 0 ? 'Missing' : `${titleLen} chars`, tip: titleLen === 0 ? 'Add a <title> tag' : titleLen < 30 ? 'Too short — aim for 50-60 chars' : titleLen > 60 ? 'May be truncated — keep under 60 chars' : undefined },
    { label: 'Meta Description', status: descLen === 0 ? 'fail' : (descLen < 70 || descLen > 160) ? 'warn' : 'pass', value: descLen === 0 ? 'Missing' : `${descLen} chars`, tip: descLen === 0 ? 'Add meta description for CTR' : descLen < 70 ? 'Too short — aim for 150-160 chars' : descLen > 160 ? 'May be truncated — keep under 160 chars' : undefined },
    { label: 'Canonical URL', status: canonical ? 'pass' : 'warn', value: canonical || 'Not set', tip: !canonical ? 'Set <link rel="canonical"> to prevent duplicates' : undefined },
    { label: 'Viewport', status: viewport ? 'pass' : 'fail', value: viewport || 'Missing', tip: !viewport ? 'Required for mobile responsiveness' : undefined },
    { label: 'Charset', status: charset ? 'pass' : 'warn', value: charset || 'Not declared', tip: !charset ? 'Add <meta charset="UTF-8">' : undefined },
    { label: 'Language', status: lang ? 'pass' : 'warn', value: lang || 'Not set', tip: !lang ? 'Set lang on <html> for accessibility' : undefined },
    { label: 'Favicon', status: favicon ? 'pass' : 'warn', value: favicon ? 'Present' : 'Missing' },
    { label: 'Apple Touch Icon', status: appleTouchIcon ? 'pass' : 'warn', value: appleTouchIcon ? 'Present' : 'Not set' },
    { label: 'Robots', status: robots.includes('noindex') ? 'warn' : 'pass', value: robots || 'Default (index, follow)', tip: robots.includes('noindex') ? 'Page blocked from indexing' : undefined },
    { label: 'X-Robots-Tag', status: xRobotsTag.includes('noindex') ? 'warn' : 'pass', value: xRobotsTag || 'Not set', tip: xRobotsTag.includes('noindex') ? 'Header blocks indexing' : undefined },
  ];

  const passCount = checks.filter(c => c.status === 'pass').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const scorePct = Math.round((passCount / checks.length) * 100);
  const scoreClr = scorePct >= 70 ? 'var(--brand-success)' : scorePct >= 40 ? 'var(--brand-warning)' : 'var(--brand-danger)';

  const icon = (s: CheckStatus) => s === 'pass' ? <span style={{ color: 'var(--brand-success)', fontWeight: 700 }}>✓</span> : s === 'fail' ? <span style={{ color: 'var(--brand-danger)', fontWeight: 700 }}>✗</span> : <span style={{ color: 'var(--brand-warning)', fontWeight: 700 }}>⚠</span>;
  const rowBg = (s: CheckStatus) => s === 'pass' ? 'transparent' : s === 'fail' ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)';

  const allMetaTags = Object.entries(meta);

  const LenBar = ({ len, max, idealMin }: { len: number; max: number; idealMin: number }) => (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 3, borderRadius: 2, background: 'var(--border-default)', position: 'relative' }}>
        <div style={{ width: `${Math.min(100, (len / max) * 100)}%`, height: '100%', borderRadius: 2, background: len >= idealMin && len <= max ? 'var(--brand-success)' : 'var(--brand-warning)', transition: 'width 0.3s' }} />
        <div style={{ position: 'absolute', left: `${(idealMin / max) * 100}%`, top: -2, width: 1, height: 7, background: 'var(--text-tertiary)', opacity: 0.4 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 9, color: 'var(--text-quaternary)' }}>0</span>
        <span style={{ fontSize: 9, color: 'var(--text-quaternary)' }}>{idealMin}</span>
        <span style={{ fontSize: 9, color: 'var(--text-quaternary)' }}>{max}</span>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      {/* ── Health Score ────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">SEO Health</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: scoreClr }}>{scorePct}%</span>
        </div>
        <div style={{ display: 'flex', gap: 12, padding: '4px 12px 10px', justifyContent: 'center' }}>
          {[
            { n: passCount, l: 'Passed', c: 'var(--brand-success)' },
            { n: warnCount, l: 'Warnings', c: 'var(--brand-warning)' },
            { n: failCount, l: 'Failed', c: 'var(--brand-danger)' },
          ].map(b => (
            <div key={b.l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.c, display: 'inline-block' }} />
              <span style={{ color: 'var(--text-secondary)' }}>{b.n} {b.l}</span>
            </div>
          ))}
        </div>
        <div style={{ margin: '0 12px 12px', height: 4, borderRadius: 2, background: 'var(--border-default)' }}>
          <div style={{ width: `${scorePct}%`, height: '100%', borderRadius: 2, background: scoreClr, transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* ── Title & Description ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">Title & Description</span></div>
        {[
          { label: 'Page Title', text: title, len: titleLen, max: 60, idealMin: 30 },
          { label: 'Meta Description', text: description, len: descLen, max: 160, idealMin: 70 },
        ].map((item, idx) => (
          <div key={idx} style={{ padding: '10px 12px', borderBottom: idx === 0 ? '1px solid var(--border-subtle)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                background: item.len === 0 ? 'rgba(239,68,68,0.1)' : item.len >= item.idealMin && item.len <= item.max ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                color: item.len === 0 ? 'var(--brand-danger)' : item.len >= item.idealMin && item.len <= item.max ? 'var(--brand-success)' : 'var(--brand-warning)',
              }}>{item.len}/{item.max}</span>
            </div>
            <div style={{ fontSize: 12, color: item.text ? 'var(--text-primary)' : 'var(--text-tertiary)', fontStyle: item.text ? 'normal' : 'italic', wordBreak: 'break-word', lineHeight: 1.5 }}>
              {item.text || `No ${item.label.toLowerCase()} found`}
            </div>
            <LenBar len={item.len} max={item.max} idealMin={item.idealMin} />
          </div>
        ))}
      </div>

      {/* ── Checklist ──────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">SEO Checklist</span></div>
        {checks.map((c, i) => (
          <div key={i} style={{ padding: '7px 12px', borderBottom: i < checks.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: rowBg(c.status) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: '0 0 16px', textAlign: 'center', fontSize: 13 }}>{icon(c.status)}</span>
              <span style={{ flex: '0 0 130px', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{c.label}</span>
              <span style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>{c.value}</span>
            </div>
            {c.tip && <div style={{ marginTop: 3, marginLeft: 24, fontSize: 10, color: c.status === 'fail' ? 'var(--brand-danger)' : 'var(--brand-warning)', lineHeight: 1.4 }}>💡 {c.tip}</div>}
          </div>
        ))}
      </div>

      {/* ── All Meta Tags ──────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header"><span className="card-title">All Meta Tags ({allMetaTags.length})</span></div>
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          {allMetaTags.length > 0 ? allMetaTags.map(([k, v]) => (
            <div key={k} className="prop-row" style={{ alignItems: 'flex-start', padding: '5px 12px' }}>
              <span className="prop-name" style={{ flex: '0 0 130px', wordBreak: 'break-all', fontSize: 10, fontFamily: 'var(--font-mono)' }}>{k}</span>
              <span className="prop-value" style={{ flex: 1, wordBreak: 'break-all', whiteSpace: 'normal', fontSize: 11 }}>{v}</span>
            </div>
          )) : <div className="empty-desc" style={{ padding: 12 }}>No meta tags found</div>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Social / OG Section
// ══════════════════════════════════════════════════════════════════════════════

function SocialSection({ data }: { data: DomainInfo }) {
  const meta = data.metadata;
  const ogTitle = meta['og:title'] || meta['title'] || '';
  const ogDesc = meta['og:description'] || meta['description'] || '';
  const ogImage = meta['og:image'] || meta['twitter:image'] || '';
  const ogUrl = meta['og:url'] || data.url;
  const ogSiteName = meta['og:site_name'] || '';
  const twitterCard = meta['twitter:card'] || '';

  const [simPlatform, setSimPlatform] = useState<'facebook' | 'twitter' | 'linkedin' | 'discord' | 'whatsapp' | 'slack'>('facebook');

  let displayHost = data.hostname;
  try { displayHost = new URL(ogUrl).hostname; } catch { /* use default */ }

  const OG_TAGS: { tag: string; critical: boolean }[] = [
    { tag: 'og:title', critical: true }, { tag: 'og:description', critical: true },
    { tag: 'og:image', critical: true }, { tag: 'og:url', critical: true },
    { tag: 'og:type', critical: true }, { tag: 'og:site_name', critical: false },
    { tag: 'og:locale', critical: false }, { tag: 'og:locale:alternate', critical: false },
    { tag: 'og:image:width', critical: false }, { tag: 'og:image:height', critical: false },
    { tag: 'og:image:alt', critical: false }, { tag: 'og:image:type', critical: false },
    { tag: 'og:video', critical: false }, { tag: 'og:audio', critical: false },
    { tag: 'og:determiner', critical: false },
  ];
  const ogScore = OG_TAGS.filter(t => !!meta[t.tag]).length;

  const TWITTER_TAGS: { tag: string; critical: boolean }[] = [
    { tag: 'twitter:card', critical: true }, { tag: 'twitter:site', critical: true },
    { tag: 'twitter:creator', critical: false }, { tag: 'twitter:title', critical: true },
    { tag: 'twitter:description', critical: true }, { tag: 'twitter:image', critical: true },
    { tag: 'twitter:image:alt', critical: false },
  ];
  const twScore = TWITTER_TAGS.filter(t => !!meta[t.tag]).length;

  const ogKeys = new Set(OG_TAGS.map(t => t.tag));
  const twKeys = new Set(TWITTER_TAGS.map(t => t.tag));
  const extraOg = Object.entries(meta).filter(([k]) => k.startsWith('og:') && !ogKeys.has(k));
  const extraTw = Object.entries(meta).filter(([k]) => k.startsWith('twitter:') && !twKeys.has(k));

  const PLATFORMS = [
    { name: 'Facebook', tags: ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'] },
    { name: 'Twitter/X', tags: ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:site'] },
    { name: 'LinkedIn', tags: ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'] },
    { name: 'Discord', tags: ['og:title', 'og:description', 'og:image', 'og:site_name', 'og:type'] },
    { name: 'WhatsApp', tags: ['og:title', 'og:description', 'og:image', 'og:url'] },
    { name: 'Slack', tags: ['og:title', 'og:description', 'og:image', 'og:site_name'] },
    { name: 'Pinterest', tags: ['og:title', 'og:description', 'og:image', 'og:type', 'og:url'] },
    { name: 'Telegram', tags: ['og:title', 'og:description', 'og:image', 'og:url'] },
  ];

  const tIcon = (v: string | undefined, c: boolean) => v ? <span style={{ color: 'var(--brand-success)', fontSize: 12, fontWeight: 700 }}>✓</span> : c ? <span style={{ color: 'var(--brand-danger)', fontSize: 12, fontWeight: 700 }}>✗</span> : <span style={{ color: 'var(--brand-warning)', fontSize: 12 }}>—</span>;
  const tClr = (v: string | undefined, c: boolean) => v ? 'var(--brand-success)' : c ? 'var(--brand-danger)' : 'var(--brand-warning)';
  const sClr = (s: number, t: number) => { const p = s / t; return p >= 0.7 ? 'var(--brand-success)' : p >= 0.4 ? 'var(--brand-warning)' : 'var(--brand-danger)'; };

  const TagList = ({ tags, extras }: { tags: { tag: string; critical: boolean }[]; extras: [string, string][] }) => (
    <div>
      {tags.map(({ tag, critical }) => (
        <div key={tag} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 12px', background: !meta[tag] && critical ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
          <span style={{ flex: '0 0 16px', textAlign: 'center', paddingTop: 1 }}>{tIcon(meta[tag], critical)}</span>
          <span style={{ flex: '0 0 135px', fontSize: 10, fontFamily: 'var(--font-mono)', color: tClr(meta[tag], critical), paddingTop: 1 }}>{tag}</span>
          <span style={{ flex: 1, wordBreak: 'break-all', whiteSpace: 'normal', fontSize: 11, lineHeight: 1.4, color: meta[tag] ? 'var(--text-primary)' : 'var(--text-tertiary)', fontStyle: meta[tag] ? 'normal' : 'italic' }}>
            {meta[tag] || (critical ? 'Missing (required)' : 'Not specified')}
          </span>
        </div>
      ))}
      {extras.length > 0 && (<>
        <div style={{ padding: '6px 12px 2px', fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 700 }}>Additional Tags</div>
        {extras.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 12px' }}>
            <span style={{ flex: '0 0 16px', textAlign: 'center' }}><span style={{ color: 'var(--brand-success)', fontSize: 12 }}>✓</span></span>
            <span style={{ flex: '0 0 135px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--brand-success)' }}>{k}</span>
            <span style={{ flex: 1, wordBreak: 'break-all', whiteSpace: 'normal', fontSize: 11, lineHeight: 1.4 }}>{v}</span>
          </div>
        ))}
      </>)}
    </div>
  );

  return (
    <div className="animate-fade-in">
      {/* ── OG Validation ──────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">OG Tags Validation</span>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 12, background: `${sClr(ogScore, OG_TAGS.length)}15`, color: sClr(ogScore, OG_TAGS.length) }}>{ogScore}/{OG_TAGS.length} Present</span>
        </div>
        <div style={{ margin: '0 12px 8px', height: 4, borderRadius: 2, background: 'var(--border-default)' }}>
          <div style={{ width: `${(ogScore / OG_TAGS.length) * 100}%`, height: '100%', borderRadius: 2, background: sClr(ogScore, OG_TAGS.length), transition: 'width 0.3s' }} />
        </div>
        <div style={{ maxHeight: 340, overflow: 'auto' }}><TagList tags={OG_TAGS} extras={extraOg} /></div>
      </div>

      {/* ── Twitter Card ───────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">Twitter Card</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {twitterCard && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{twitterCard}</span>}
            <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 12, background: `${sClr(twScore, TWITTER_TAGS.length)}15`, color: sClr(twScore, TWITTER_TAGS.length) }}>{twScore}/{TWITTER_TAGS.length}</span>
          </div>
        </div>
        <div style={{ margin: '0 12px 8px', height: 4, borderRadius: 2, background: 'var(--border-default)' }}>
          <div style={{ width: `${(twScore / TWITTER_TAGS.length) * 100}%`, height: '100%', borderRadius: 2, background: sClr(twScore, TWITTER_TAGS.length), transition: 'width 0.3s' }} />
        </div>
        <div style={{ maxHeight: 260, overflow: 'auto' }}><TagList tags={TWITTER_TAGS} extras={extraTw} /></div>
      </div>

      {/* ── Social Preview ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">Social Preview</span>
          <div className="tab-pills" style={{ flexWrap: 'wrap', gap: 4 }}>
            {(['facebook', 'twitter', 'linkedin', 'discord', 'whatsapp', 'slack'] as const).map(p => (
              <button key={p} className={`tab-pill ${simPlatform === p ? 'active' : ''}`} onClick={() => setSimPlatform(p)} style={{ fontSize: 10, padding: '3px 8px' }}>
                {p === 'twitter' ? 'X' : p === 'linkedin' ? 'In' : p === 'whatsapp' ? 'WA' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: 12, background: 'var(--bg-hover)', borderRadius: 8, margin: '0 12px 12px' }}>
          {/* Facebook */}
          {simPlatform === 'facebook' && (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 4, overflow: 'hidden', background: 'var(--bg-panel)' }}>
              {ogImage ? <img src={ogImage} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 11 }}>No og:image</div>}
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{displayHost}</div>
                <div style={{ fontSize: 14, fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)' }}>{ogTitle || 'No title'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ogDesc || 'No description'}</div>
              </div>
            </div>
          )}
          {/* Twitter/X */}
          {simPlatform === 'twitter' && (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-panel)' }}>
              {ogImage ? <img src={ogImage} alt="" style={{ width: '100%', height: twitterCard === 'summary' ? 100 : 160, objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 11 }}>No image</div>}
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{displayHost}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{meta['twitter:title'] || ogTitle || 'No title'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxHeight: 36, overflow: 'hidden' }}>{meta['twitter:description'] || ogDesc || 'No description'}</div>
              </div>
            </div>
          )}
          {/* LinkedIn */}
          {simPlatform === 'linkedin' && (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden', background: 'var(--bg-panel)' }}>
              {ogImage ? <img src={ogImage} alt="" style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 11 }}>No image</div>}
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{ogTitle || 'No title'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{displayHost}{ogSiteName ? ` · ${ogSiteName}` : ''}</div>
              </div>
            </div>
          )}
          {/* Discord */}
          {simPlatform === 'discord' && (
            <div style={{ borderLeft: '4px solid #5865F2', borderRadius: 4, background: 'var(--bg-panel)', padding: 12 }}>
              {ogSiteName && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>{ogSiteName}</div>}
              <div style={{ fontSize: 14, fontWeight: 700, color: '#00AFF4', marginBottom: 4 }}>{ogTitle || 'No title'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: ogImage ? 8 : 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ogDesc || 'No description'}</div>
              {ogImage && <img src={ogImage} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4, display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
            </div>
          )}
          {/* WhatsApp */}
          {simPlatform === 'whatsapp' && (
            <div style={{ background: '#DCF8C6', borderRadius: 8, padding: 8, maxWidth: '85%', marginLeft: 'auto' }}>
              <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>
                {ogImage ? <img src={ogImage} alt="" style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', fontSize: 11 }}>No preview</div>}
                <div style={{ padding: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{ogTitle || 'No title'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ogDesc || ''}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>{displayHost}</div>
                </div>
              </div>
            </div>
          )}
          {/* Slack */}
          {simPlatform === 'slack' && (
            <div style={{ borderLeft: '4px solid var(--border-subtle)', paddingLeft: 12 }}>
              {ogSiteName && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 2 }}>{ogSiteName}</div>}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1d9bd1' }}>{ogTitle || 'No title'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', margin: '4px 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ogDesc || 'No description'}</div>
              {ogImage && <img src={ogImage} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, marginTop: 8 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
            </div>
          )}
        </div>
      </div>

      {/* ── Platform Matrix ────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header"><span className="card-title">Platform Tag Coverage</span></div>
        <div style={{ overflow: 'auto', padding: '0 4px 8px' }}>
          <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', fontFamily: 'var(--font-mono)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Platform</th>
                <th style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Score</th>
                {['title', 'desc', 'image', 'url', 'type', 'site'].map(h => (
                  <th key={h} style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLATFORMS.map(p => {
                const cnt = p.tags.filter(t => !!meta[t]).length;
                return (
                  <tr key={p.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>{p.name}</td>
                    <td style={{ textAlign: 'center', padding: '5px 4px', color: cnt === p.tags.length ? 'var(--brand-success)' : 'var(--brand-warning)', fontWeight: 700 }}>{cnt}/{p.tags.length}</td>
                    {['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:site_name'].map(tag => {
                      if (p.name === 'Twitter/X') {
                        const tw = tag === 'og:site_name' ? 'twitter:site' : tag.replace('og:', 'twitter:');
                        const need = p.tags.includes(tw);
                        if (!need) return <td key={tag} style={{ textAlign: 'center', padding: '5px 4px', color: 'var(--text-quaternary)' }}>·</td>;
                        return <td key={tag} style={{ textAlign: 'center', padding: '5px 4px' }}>{(!!meta[tw] || !!meta[tag]) ? <span style={{ color: 'var(--brand-success)' }}>✓</span> : <span style={{ color: 'var(--brand-danger)' }}>✗</span>}</td>;
                      }
                      const need = p.tags.includes(tag);
                      if (!need) return <td key={tag} style={{ textAlign: 'center', padding: '5px 4px', color: 'var(--text-quaternary)' }}>·</td>;
                      return <td key={tag} style={{ textAlign: 'center', padding: '5px 4px' }}>{!!meta[tag] ? <span style={{ color: 'var(--brand-success)' }}>✓</span> : <span style={{ color: 'var(--brand-danger)' }}>✗</span>}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



function PerformanceSection({ data }: { data: DomainInfo }) {
  const perf = data.performance || {};

  const metrics = [
    { name: 'TTFB', value: perf.ttfb ? `${Math.round(perf.ttfb)}ms` : 'N/A' },
    { name: 'DNS Lookup', value: perf.dnsLookup ? `${Math.round(perf.dnsLookup)}ms` : 'N/A' },
    { name: 'TCP Connect', value: perf.tcpConnect ? `${Math.round(perf.tcpConnect)}ms` : 'N/A' },
    { name: 'DOM Content Loaded', value: perf.domContentLoad ? `${Math.round(perf.domContentLoad)}ms` : 'N/A' },
    { name: 'Full Load', value: perf.fullLoad ? `${Math.round(perf.fullLoad)}ms` : 'N/A' },
  ];

  const resources = [
    { name: 'Total Resources', value: perf.resourceCount },
    { name: 'Scripts', value: perf.scriptCount },
    { name: 'Stylesheets', value: perf.cssCount },
    { name: 'Images', value: perf.imageCount },
    { name: 'Transfer Size', value: perf.transferSize ? `${(perf.transferSize / 1024).toFixed(1)} KB` : 'N/A' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Navigation Timing</span>
        </div>
        {metrics.map(m => (
          <div className="prop-row" key={m.name}>
            <span className="prop-name">{m.name}</span>
            <span className="prop-value">{m.value}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <span className="card-title">Resource Summary</span>
        </div>
        {resources.map(r => (
          <div className="prop-row" key={r.name}>
            <span className="prop-name">{r.name}</span>
            <span className="prop-value">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RawSection({ data }: { data: DomainInfo }) {
  return (
    <div className="animate-fade-in">
      <div className="card" style={{ padding: 12, background: 'var(--bg-hover)', border: 'none' }}>
        <pre style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)', overflow: 'auto', maxHeight: 400, fontFamily: 'monospace' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

