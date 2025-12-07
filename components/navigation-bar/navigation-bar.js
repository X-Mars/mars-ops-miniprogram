Component({
  options: {
    multipleSlots: true // 在组件定义时的选项中启用多slot支持
  },
  /**
   * 组件的属性列表
   */
  properties: {
    extClass: {
      type: String,
      value: ''
    },
    title: {
      type: String,
      value: ''
    },
    background: {
      type: String,
      value: ''
    },
    color: {
      type: String,
      value: ''
    },
    back: {
      type: Boolean,
      value: true
    },
    loading: {
      type: Boolean,
      value: false
    },
    homeButton: {
      type: Boolean,
      value: false,
    },
    animated: {
      // 显示隐藏的时候opacity动画效果
      type: Boolean,
      value: true
    },
    show: {
      // 显示隐藏导航，隐藏的时候navigation-bar的高度占位还在
      type: Boolean,
      value: true,
      observer: '_showChange'
    },
    // back为true的时候，返回的页面深度
    delta: {
      type: Number,
      value: 1
    },
  },
  /**
   * 组件的初始数据
   */
  data: {
    displayStyle: ''
  },
  lifetimes: {
    attached() {
      const rect = wx.getMenuButtonBoundingClientRect()
      const systemInfo = wx.getDeviceInfo()
      const windowInfo = wx.getWindowInfo()
      
      const isAndroid = systemInfo.platform === 'android'
      const isDevtools = systemInfo.platform === 'devtools'
      
      this.setData({
        ios: !isAndroid,
        innerPaddingRight: `padding-right: ${windowInfo.windowWidth - rect.left}px`,
        leftWidth: `width: ${windowInfo.windowWidth - rect.left}px`,
        safeAreaTop: isDevtools || isAndroid ? `height: calc(var(--height) + ${windowInfo.safeArea.top}px); padding-top: ${windowInfo.safeArea.top}px` : ``
      })
    },
  },
  /**
   * 组件的方法列表
   */
  methods: {
    _showChange(show) {
      const animated = this.data.animated
      let displayStyle = ''
      if (animated) {
        displayStyle = `opacity: ${
          show ? '1' : '0'
        };transition:opacity 0.5s;`
      } else {
        displayStyle = `display: ${show ? '' : 'none'}`
      }
      this.setData({
        displayStyle
      })
    },
    back() {
      const data = this.data
      const pages = getCurrentPages() || []
      if (pages.length > 1 && data.delta) {
        wx.navigateBack({ delta: data.delta })
      } else {
        // 如果没有可返回的页面（直接打开或栈深度1），尝试切换到 Zabbix tab 作为退回目标
        try {
          wx.switchTab({ url: '/pages/zabbix/zabbix' })
        } catch (e) {
          // fallback: 如果 switchTab 不可用，则尝试 navigateTo 回主页面
          try {
            wx.navigateTo({ url: '/pages/zabbix/zabbix' })
          } catch (err) {
            // ignore
          }
        }
      }
      this.triggerEvent('back', { delta: data.delta }, {})
    }
  },
})
