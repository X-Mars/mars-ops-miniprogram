/**
 * Zabbix API 工具类
 * 参考文档: https://www.zabbix.com/documentation/7.0/zh/manual/api
 */

class ZabbixAPI {
  /**
   * 构造函数
   * @param {string} apiUrl - Zabbix API地址 (例如: https://example.com/zabbix/api_jsonrpc.php)
   * @param {string} token - API Token (从Zabbix前端生成)
   */
  constructor(apiUrl, token) {
    this.apiUrl = apiUrl;
    this.token = token;
    this.requestId = 1;
  }

  /**
   * 发送 API 请求
   * @param {string} method - API 方法名
   * @param {object} params - 请求参数
   * @param {boolean} skipAuth - 是否跳过授权标头（某些方法如 apiinfo.version 不需要）
   * @returns {Promise} 返回响应结果
   */
  async request(method, params = {}, skipAuth = false) {
    try {
      const requestData = {
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: this.requestId++
      };

      // 构建请求头
      const headers = {
        'Content-Type': 'application/json-rpc'
      };
      
      // 只有在不跳过授权时才添加 Authorization 标头
      if (!skipAuth) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: this.apiUrl,
          method: 'POST',
          header: headers,
          data: requestData,
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.data);
            } else {
              reject({
                code: res.statusCode,
                message: `HTTP Error: ${res.statusCode}`,
                data: res.data
              });
            }
          },
          fail: (err) => {
            reject({
              code: -1,
              message: '网络请求失败',
              data: err
            });
          }
        });
      });

      // 检查响应中是否包含错误
      if (response.error) {
        throw {
          code: response.error.code,
          message: response.error.message,
          data: response.error.data
        };
      }

      return response.result;
    } catch (error) {
      console.error('Zabbix API 请求失败:', error);
      throw error;
    }
  }

  /**
   * 获取 Zabbix API 版本
   * 此方法用于测试连接是否正常
   * 参考: https://www.zabbix.com/documentation/7.0/zh/manual/api/reference/apiinfo/version
   * 
   * 注意：此方法必须在不带授权标头的情况下调用
   * 
   * @returns {Promise<string>} 返回 Zabbix API 版本号
   */
  async getVersion() {
    try {
      // apiinfo.version 方法必须不带授权标头调用
      const version = await this.request('apiinfo.version', [], true);
      return version;
    } catch (error) {
      console.error('获取 Zabbix 版本失败:', error);
      throw error;
    }
  }

  /**
   * 测试连接
   * 通过获取版本信息来验证 API 地址和 Token 是否正确
   * 
   * @returns {Promise<object>} 返回测试结果
   */
  async testConnection() {
    try {
      const version = await this.getVersion();
      return {
        success: true,
        version: version,
        message: '连接成功'
      };
    } catch (error) {
      return {
        success: false,
        version: null,
        message: error.message || '连接失败',
        error: error
      };
    }
  }

  /**
   * 获取主机数量
   * 参考: https://www.zabbix.com/documentation/7.0/zh/manual/api/reference/host/get
   * 
   * @returns {Promise<number>} 返回主机总数
   */
  async getHostCount() {
    try {
      const result = await this.request('host.get', {
        countOutput: true
      });
      return parseInt(result) || 0;
    } catch (error) {
      console.error('获取主机数量失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前问题（告警）数量
   * 参考: https://www.zabbix.com/documentation/7.0/zh/manual/api/reference/problem/get
   * 
   * @returns {Promise<number>} 返回当前未解决的问题数量
   */
  async getProblemCount() {
    try {
      const result = await this.request('problem.get', {
        countOutput: true,
        recent: false,  // 只获取未解决的问题
        suppressed: false  // 不包含被抑制的问题
      });
      return parseInt(result) || 0;
    } catch (error) {
      console.error('获取问题数量失败:', error);
      throw error;
    }
  }

  /**
   * 获取有告警的主机列表
   * 
   * @returns {Promise<Array>} 返回有告警的主机列表
   */
  async getHostsWithProblems() {
    try {
      // 首先获取所有未解决的问题
      
      const triggers = await this.request('trigger.get', {
        'output': 'extend',
        'selectHosts': ['hostid', 'host', 'name'],           // 主机技术名和可见名称
        'selectItems': [
            'itemid',
            'name',
            'key_',
            'lastvalue',
            'lastclock',
            'value_type'
        ],
        'filter': {
            'value': 1                                      // 只取当前 PROBLEM 状态的触发器
        },
        'monitored': true,
        'active': true,
        'skipDependent': true,
        'expandDescription': true,
        'expandExpression': true,
        'expandComment': true
      });

      if (!triggers || triggers.length === 0) {
        return [];
      }

      // console.log('triggers with problems:', triggers);
      
      const problems = await this.request('problem.get', {
        // 增加 name 字段以便前端显示问题标题/名称
        output: 'extend',
        recent: false,
        suppressed: false,
        sortfield: ['eventid'],
        sortorder: 'DESC'
      });

      if (!problems || problems.length === 0) {
        return [];
      }
      console.log('problems:', problems);

      triggers.map(trigger => {
        const relatedProblems = problems.filter(problem => problem.objectid === trigger.triggerid);
        console.log(`Trigger ID: ${trigger.triggerid}, Related Problems:`, relatedProblems);
        // 将relatedProblems的name添加到trigger对象中
        trigger.problems = relatedProblems;
      });
      console.log('triggers with problems:', triggers);

      return triggers;
    } catch (error) {
      console.error('获取告警主机失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有主机详细信息
   * 
   * @returns {Promise<Array>} 返回所有主机列表，包含主机名、IP、分组、告警数量
   */
  async getAllHosts() {
    try {
      // 获取所有主机及其接口和分组信息
      const hosts = await this.request('host.get', {
        output: ['hostid', 'host', 'name', 'status'],
        selectInterfaces: ['ip'],
        selectHostGroups: ['name'],
        filter: {
          status: 0  // 只获取启用的主机
        }
      });

      // 获取所有未解决的问题
      const problems = await this.request('problem.get', {
        // 增加 name 字段供展示/统计使用
        output: ['objectid', 'severity', 'name'],
        recent: false,
        suppressed: false
      });

      // 提取触发器ID
      const triggerIds = [...new Set(problems.map(p => p.objectid))];

      // 获取触发器和主机的对应关系
      let hostProblems = new Map();
      if (triggerIds.length > 0) {
        const triggers = await this.request('trigger.get', {
          output: ['triggerid'],
          triggerids: triggerIds,
          selectHosts: ['hostid']
        });

        // 统计每个主机的问题数量
        problems.forEach(problem => {
          const trigger = triggers.find(t => t.triggerid === problem.objectid);
          if (trigger && trigger.hosts) {
            trigger.hosts.forEach(host => {
              const count = hostProblems.get(host.hostid) || 0;
              hostProblems.set(host.hostid, count + 1);
            });
          }
        });
      }

      // 组装主机数据
      const hostList = hosts.map(host => {
        return {
          hostid: host.hostid,
          host: host.host,
          name: host.name || host.host,
          ip: host.interfaces && host.interfaces.length > 0 ? host.interfaces[0].ip : '-',
          groups: host.hostgroups && host.hostgroups.length > 0 
            ? host.hostgroups.map(g => g.name).join(', ') 
            : '-',
          problemCount: hostProblems.get(host.hostid) || 0
        };
      });

      // 帮助函数：格式化为 2 位小数（返回字符串），如果是 0..1 的小数则乘 100
      const _formatPercent = (val) => {
        const n = parseFloat(val)
        if (!Number.isFinite(n)) return val
        const v = Math.abs(n) <= 1 ? (n * 100) : n
        return Number.isFinite(v) ? v.toFixed(2) : val
      }

      // 帮助函数：将字节数转换为 GB 字符串（保留两位）
      const _bytesToGBString = (val) => {
        const n = parseFloat(val)
        if (!Number.isFinite(n)) return val
        const gb = n / (1024 * 1024 * 1024)
        return gb.toFixed(2) + ' GB'
      }

      // 帮助函数：将秒数转换为可读运行时间（例如 "3d 4h 12m"）
      const _secondsToHuman = (val) => {
        const n = parseFloat(val)
        if (!Number.isFinite(n)) return val
        let seconds = Math.floor(n)
        const days = Math.floor(seconds / 86400)
        seconds -= days * 86400
        const hours = Math.floor(seconds / 3600)
        seconds -= hours * 3600
        const minutes = Math.floor(seconds / 60)
        const parts = []
        if (days > 0) parts.push(days + 'd')
        if (hours > 0) parts.push(hours + 'h')
        if (minutes > 0) parts.push(minutes + 'm')
        if (parts.length === 0) return (n.toFixed(0) + 's')
        return parts.join(' ')
      }

      // 尝试为每个主机附加实时指标（cpu / memory / cpuCount / totalMemory）
      try {
        const metricsResults = await Promise.allSettled(hostList.map(h => this.getHostMetrics(h.hostid)));
        metricsResults.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value) {
            const m = res.value;
            hostList[idx].cpuCount = m.cpuCount !== undefined ? (Number.isFinite(parseFloat(m.cpuCount)) ? parseInt(parseFloat(m.cpuCount)) : m.cpuCount) : (hostList[idx].cpuCount || null);
            // cpu/memory 使用率保留两位小数，存为不带 '%' 的字符串，页面会在展示时追加 '%'
            hostList[idx].cpu = m.cpu !== undefined && m.cpu !== null ? _formatPercent(m.cpu) : (hostList[idx].cpu || null);
            hostList[idx].memory = m.memory !== undefined && m.memory !== null ? _formatPercent(m.memory) : (hostList[idx].memory || null);
            // totalMemory 转换为 GB 字符串
            hostList[idx].totalMemory = m.totalMemory !== undefined && m.totalMemory !== null ? _bytesToGBString(m.totalMemory) : (hostList[idx].totalMemory || null);
            hostList[idx].uptime = m.uptime !== undefined && m.uptime !== null ? _secondsToHuman(m.uptime) : (hostList[idx].uptime || null);
          } else {
            // 如果失败，不影响主列表展示，仅记录警告
            // console.warn(`获取主机 ${hostList[idx] && hostList[idx].hostid} 指标失败`, res.reason || res.status);
          }
        });
      } catch (e) {
        // 非致命：指标附加失败，继续返回主机列表
        console.warn('附加主机指标时发生错误', e);
      }

      // 按告警数量降序排序
      return hostList.sort((a, b) => b.problemCount - a.problemCount);
    } catch (error) {
      console.error('获取所有主机失败:', error);
      throw error;
    }
  }

  /**
   * 获取主机的实时 CPU / 内存 指标（尽力匹配常见 key 名称）
   * 返回示例: { cpu: '12.3', memory: '34.5', cpuItem, memItem }
   */
  async getHostMetrics(hostid) {
    try {
      // 优先按监控项名称查找（用户指定的名称）
      // CPU 使用率项名："CPU utilization"
      // 内存使用率项名："Memory utilization"
      // 内核数项名："Number of CPUs"
      // 总内存项名："Total memory"
      let cpuUtilItem = null;
      let memUtilItem = null;
      let cpuCountItem = null;
      let totalMemItem = null;
      let uptimeItem = null;

      // helper to try search by name
      const trySearchName = async (name) => {
        try {
          const res = await this.request('item.get', {
            hostids: hostid,
            output: ['itemid', 'name', 'key_', 'lastvalue'],
            search: { name: name },
            sortfield: 'itemid',
            limit: 1
          });
          return (res && res.length > 0) ? res[0] : null;
        } catch (e) {
          return null;
        }
      }

      cpuUtilItem = await trySearchName('CPU utilization')
      memUtilItem = await trySearchName('Memory utilization')
      cpuCountItem = await trySearchName('Number of CPUs')
      totalMemItem = await trySearchName('Total memory')
      uptimeItem = await trySearchName('System uptime')

      // 回退策略：按 key_ 模糊查找
      if (!cpuUtilItem) {
        const cpuItems = await this.request('item.get', {
          hostids: hostid,
          output: ['itemid', 'name', 'key_', 'lastvalue'],
          search: { key_: 'cpu' },
          sortfield: 'itemid',
          limit: 5
        });
        if (cpuItems && cpuItems.length > 0) cpuUtilItem = cpuItems[0];
      }

      if (!memUtilItem) {
        const memItems = await this.request('item.get', {
          hostids: hostid,
          output: ['itemid', 'name', 'key_', 'lastvalue'],
          search: { key_: 'mem' },
          sortfield: 'itemid',
          limit: 5
        });
        if (memItems && memItems.length > 0) memUtilItem = memItems[0];
      }

      // 回退 cpu count / total memory 查找：尝试按 key_ 包含常见关键词
      if (!cpuCountItem) {
        const cItems = await this.request('item.get', {
          hostids: hostid,
          output: ['itemid', 'name', 'key_', 'lastvalue'],
          search: { key_: 'num' },
          sortfield: 'itemid',
          limit: 5
        });
        if (cItems && cItems.length > 0) cpuCountItem = cItems[0];
      }

      if (!totalMemItem) {
        const tItems = await this.request('item.get', {
          hostids: hostid,
          output: ['itemid', 'name', 'key_', 'lastvalue'],
          search: { key_: 'total' },
          sortfield: 'itemid',
          limit: 5
        });
        if (tItems && tItems.length > 0) totalMemItem = tItems[0];
      }

      // 回退 uptime 查找：尝试按 key_ 包含常见关键词
      if (!uptimeItem) {
        const uItems = await this.request('item.get', {
          hostids: hostid,
          output: ['itemid', 'name', 'key_', 'lastvalue'],
          search: { key_: 'uptime' },
          sortfield: 'itemid',
          limit: 5
        });
        if (uItems && uItems.length > 0) uptimeItem = uItems[0];
      }

      const cpu = cpuUtilItem ? cpuUtilItem.lastvalue : null;
      const memory = memUtilItem ? memUtilItem.lastvalue : null;
      const cpuCount = cpuCountItem ? cpuCountItem.lastvalue : null;
      const totalMemory = totalMemItem ? totalMemItem.lastvalue : null;
      const uptime = uptimeItem ? uptimeItem.lastvalue : null;

      return {
        cpu,
        memory,
        cpuItem: cpuUtilItem,
        memItem: memUtilItem,
        cpuCount,
        totalMemory,
        uptime,
        cpuCountItem,
        totalMemItem,
        uptimeItem
      };
    } catch (error) {
      console.error('获取主机指标失败:', error);
      throw error;
    }
  }

  /**
   * 获取监控概览数据
   * 
   * @returns {Promise<object>} 返回包含主机数量、告警数量和告警主机的对象
   */
  async getOverview() {
    try {
      const [hostCount, problemCount, hostsWithProblems] = await Promise.all([
        this.getHostCount(),
        this.getProblemCount(),
        this.getHostsWithProblems()
      ]);

      return {
        hostCount,
        problemCount,
        hostsWithProblems
      };
    } catch (error) {
      console.error('获取监控概览失败:', error);
      throw error;
    }
  }
}

module.exports = {
  ZabbixAPI
};
