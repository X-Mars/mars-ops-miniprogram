// pages/zabbix/zabbix.js
const { ZabbixAPI } = require('../../utils/zabbix.js')

Component({
  data: {
    title: 'Zabbix 监控',
    updateTime: '',
    // 概览数据
    hostCount: 0,
    problemCount: 0,
    hostsWithProblems: [],
    // 扁平化的当前告警列表（保留以便复用，但 UI 已迁移）
    currentProblems: [],
    // 弹窗控制（保留）
    popupVisible: false,
    popupData: {},
    // 是否显示当前告警列表（已迁移，但保留字段）
    showCurrentProblems: false,
    // 加载状态
    loading: false,
    // t-pull-down-refresh 控制值
    enable: false,
    hasConfig: false
  },

  lifetimes: {
    attached() {
      this.setData({ updateTime: this.getCurrentTime() })
      // 在组件挂载时调用 loadData
      if (typeof this.loadData === 'function') {
        this.loadData()
      }
    }
  },

  methods: {
    getCurrentTime() {
      const now = new Date()
      const year = now.getFullYear()
      const month = (now.getMonth() + 1).toString().padStart(2, '0')
      const day = now.getDate().toString().padStart(2, '0')
      const hour = now.getHours().toString().padStart(2, '0')
      const minute = now.getMinutes().toString().padStart(2, '0')
      const second = now.getSeconds().toString().padStart(2, '0')
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`
    },

    // 加载数据
    async loadData() {
      try {
        // 获取默认配置，若未设置默认则尝试使用配置列表中的第一个配置作为回退
        let defaultConfig = wx.getStorageSync('zabbix_default_config')
        if (!defaultConfig || !defaultConfig.apiUrl || !defaultConfig.token) {
          const list = wx.getStorageSync('zabbix_config_list') || []
          if (list && list.length > 0) {
            defaultConfig = list[0]
          }
        }

        if (!defaultConfig || !defaultConfig.apiUrl || !defaultConfig.token) {
          this.setData({ hasConfig: false })
          return
        }

        this.setData({ hasConfig: true, loading: true })

        const api = new ZabbixAPI(defaultConfig.apiUrl, defaultConfig.token)
        const overview = await api.getOverview()

        // 扁平化当前告警
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

        this.setData({
          hostCount: overview.hostCount,
          problemCount: overview.problemCount,
          hostsWithProblems: overview.hostsWithProblems,
          currentProblems: currentProblems,
          updateTime: this.getCurrentTime(),
          loading: false
        })
      } catch (error) {
        console.error('加载数据失败:', error)
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'error' })
      }
    },

    // 下拉刷新数据（兼容 t-pull-down-refresh）
    async refreshData(e) {
      try {
        this.setData({ enable: true })
        await this.loadData()
      } finally {
        this.setData({ enable: false })
      }
    },

    // 点击主机数量卡片：跳转到独立的主机页查看所有主机
    onHostCardTap() {
      wx.navigateTo({ url: '/pages/zabbix_host/zabbixHost' })
    },

    // 点击“当前告警”统计卡：跳转到独立的告警页面查看
    onProblemCardTap() {
      wx.navigateTo({ url: '/pages/zabbix_problem/zabbixProblem' })
    },

    // 获取严重性文本
    getSeverityText(severity) {
      const severityMap = {
        0: '未分类',
        1: '信息',
        2: '警告',
        3: '一般严重',
        4: '严重',
        5: '灾难'
      }
      return severityMap[severity] || '未知'
    },

    // 格式化数值，保留两位小数，非数值返回原值
    formatTwoDecimals(value) {
      const n = parseFloat(value)
      if (Number.isFinite(n)) return n.toFixed(2)
      return value
    },

    // 将字节数或数值转换为合适的单位（GB），保留两位小数；如果无法解析，返回原值
    formatBytesToGB(value) {
      const n = parseFloat(value)
      if (!Number.isFinite(n)) return value
      const gb = n / (1024 * 1024 * 1024)
      return gb.toFixed(2) + ' GB'
    },

    // 获取严重性颜色
    getSeverityColor(severity) {
      const colorMap = {
        0: '#97AAB3',
        1: '#7499FF',
        2: '#FFC859',
        3: '#FFA059',
        4: '#E97659',
        5: '#E45959'
      }
      return colorMap[severity] || '#97AAB3'
    },

    // 保留兼容：单条告警弹窗的展示逻辑（页面已迁移，但保留方法以防被调用）
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
    }
  }
})