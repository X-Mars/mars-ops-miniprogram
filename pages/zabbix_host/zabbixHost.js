// pages/zabbix_host/zabbixHost.js
const { ZabbixAPI } = require('../../utils/zabbix.js')

Page({
  data: {
    allHosts: [],
    hostPopupVisible: false,
    hostPopupData: {},
    loading: false
  },

  onLoad() {
  },

  onShow() {
    this.loadAllHosts()
  },

  // 加载所有主机列表
  async loadAllHosts() {
    try {
      const defaultConfig = wx.getStorageSync('zabbix_default_config')
      if (!defaultConfig || !defaultConfig.apiUrl || !defaultConfig.token) {
        wx.showToast({ title: '请先配置 Zabbix API', icon: 'none' })
        return
      }

      this.setData({ loading: true })
      wx.showLoading({ title: '加载中...', mask: true })

      const api = new ZabbixAPI(defaultConfig.apiUrl, defaultConfig.token)
      const hosts = await api.getAllHosts()

      // 为展示准备额外字段：domainPreview（域名摘要）、displayGroups（分组字符串）
      const adorned = (hosts || []).map(h => {
        const name = h.name || h.host || ''
        let domainPreview = ''
        if (name && name.indexOf('.') !== -1) {
          const parts = name.split('.')
          domainPreview = parts.slice(-2).join('.')
        }
        let displayGroups = ''
        try {
          if (Array.isArray(h.groups)) {
            displayGroups = h.groups.map(g => (g.name || g)).join(', ')
          } else if (typeof h.groups === 'string') {
            displayGroups = h.groups
          } else if (h.groups && h.groups.length === 0) {
            displayGroups = ''
          }
        } catch (e) {
          displayGroups = ''
        }

        return Object.assign({}, h, { name, domainPreview, displayGroups })
      })

      this.setData({ allHosts: adorned })
      wx.hideLoading()
      this.setData({ loading: false })
    } catch (err) {
      console.error('加载所有主机失败', err)
      wx.hideLoading()
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'error' })
    }
  },

  // 将数值格式化，保留两位小数
  formatTwoDecimals(value) {
    const n = parseFloat(value)
    if (Number.isFinite(n)) return n.toFixed(2)
    return value
  },

  // 将字节数或数值转换为 GB 字符串
  formatBytesToGB(value) {
    const n = parseFloat(value)
    if (!Number.isFinite(n)) return value
    const gb = n / (1024 * 1024 * 1024)
    return gb.toFixed(2) + ' GB'
  },

  // 将秒数转换为可读运行时间
  formatUptime(value) {
    const n = parseFloat(value)
    if (!Number.isFinite(n)) return value
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
  },

  // 点击主机行，获取指标并弹窗显示
  async onHostRowTap(e) {
    const idx = e.currentTarget.dataset.idx
    const item = this.data.allHosts && this.data.allHosts[idx]
    if (!item) return

    const defaultConfig = wx.getStorageSync('zabbix_default_config')
    if (!defaultConfig || !defaultConfig.apiUrl || !defaultConfig.token) {
      wx.showToast({ title: '请先配置 Zabbix API', icon: 'none' })
      return
    }

    const api = new ZabbixAPI(defaultConfig.apiUrl, defaultConfig.token)
    try {
      wx.showLoading({ title: '获取指标...', mask: true })
      const metrics = await api.getHostMetrics(item.hostid)
      wx.hideLoading()

      this.setData({
        hostPopupData: {
          name: item.name || item.host,
          ip: item.ip || '-',
          uptime: metrics.uptime ? this.formatUptime(metrics.uptime) : 'N/A',
          cpu: this.formatTwoDecimals(metrics.cpu),
          memory: this.formatTwoDecimals(metrics.memory),
          cpuCount: metrics.cpuCount ? (Number.isFinite(parseFloat(metrics.cpuCount)) ? parseInt(metrics.cpuCount) : metrics.cpuCount) : 'N/A',
          totalMemory: metrics.totalMemory ? this.formatBytesToGB(metrics.totalMemory) : 'N/A'
        },
        hostPopupVisible: true
      })
      // 把指标值写回表格行，保证新增的内存/内存使用率列能立即显示
      try {
        const all = this.data.allHosts ? this.data.allHosts.slice() : []
          if (all[idx]) {
          all[idx] = Object.assign({}, all[idx], {
            cpuCount: metrics.cpuCount ? (Number.isFinite(parseFloat(metrics.cpuCount)) ? parseInt(metrics.cpuCount) : metrics.cpuCount) : all[idx].cpuCount,
            cpu: metrics.cpu !== undefined && metrics.cpu !== null ? this.formatTwoDecimals(metrics.cpu) : all[idx].cpu,
            totalMemory: metrics.totalMemory ? this.formatBytesToGB(metrics.totalMemory) : (all[idx].totalMemory || '-'),
            memory: metrics.memory !== undefined && metrics.memory !== null ? this.formatTwoDecimals(metrics.memory) : (all[idx].memory || '-'),
            uptime: metrics.uptime !== undefined && metrics.uptime !== null ? this.formatUptime(metrics.uptime) : (all[idx].uptime || '-')
          })
          this.setData({ allHosts: all })
        }
      } catch (e) {
        // 非致命：更新表格失败不影响弹窗展示
        console.warn('回写主机指标到表格失败', e)
      }
    } catch (err) {
      wx.hideLoading()
      console.error('获取主机指标失败', err)
      wx.showToast({ title: '获取指标失败', icon: 'error' })
    }
  },

  onHostPopupClose() {
    this.setData({ hostPopupVisible: false })
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadAllHosts()
    wx.stopPullDownRefresh()
  }
})