// pages/zabbix_problem/zabbixProblem.js
const { ZabbixAPI } = require('../../utils/zabbix.js')

Page({
  data: {
    currentProblems: [],
    popupVisible: false,
    popupData: {},
    loading: false
  },

  onLoad() {},

  onShow() {
    this.loadProblems()
  },

  // 加载当前告警（使用 overview.hostsWithProblems 扁平化）
  async loadProblems() {
    try {
      const defaultConfig = wx.getStorageSync('zabbix_default_config')
      if (!defaultConfig || !defaultConfig.apiUrl || !defaultConfig.token) {
        wx.showToast({ title: '请先配置 Zabbix API', icon: 'none' })
        return
      }

      this.setData({ loading: true })
      wx.showLoading({ title: '加载中...', mask: true })

      const api = new ZabbixAPI(defaultConfig.apiUrl, defaultConfig.token)
      const overview = await api.getOverview()

      const currentProblems = []
      ;(overview.hostsWithProblems || []).forEach(trigger => {
        const host = (trigger.hosts && trigger.hosts[0]) || {}
        const item = (trigger.items && trigger.items[0]) || {}
        const problems = trigger.problems || []
        problems.forEach(p => {
          currentProblems.push({
            objectid: p.objectid || p.eventid || (p.triggerid ? String(p.triggerid) : undefined),
            name: p.name || p.description || '',
            severity: parseInt(p.severity) || 0,
            hostid: host.hostid,
            hostname: host.name || host.host || '-',
            lastvalue: item.lastvalue || '-',
            triggerid: trigger.triggerid
          })
        })
      })

      this.setData({ currentProblems, loading: false })
      wx.hideLoading()
    } catch (err) {
      console.error('加载当前告警失败', err)
      wx.hideLoading()
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'error' })
    }
  },

  onProblemTap(e) {
    const idx = e.currentTarget.dataset.idx
    const item = this.data.currentProblems && this.data.currentProblems[idx]
    if (!item) return

    this.setData({
      popupData: {
        name: item.name || '告警详情',
        hostname: item.hostname || '-',
        lastvalue: item.lastvalue || '-',
        severity: item.severity || 0,
        triggerid: item.triggerid || '-',
        objectid: item.objectid || '-'
      },
      popupVisible: true
    })
  },

  onPopupClose() {
    this.setData({ popupVisible: false })
  },

  async onPullDownRefresh() {
    await this.loadProblems()
    wx.stopPullDownRefresh()
  }
})