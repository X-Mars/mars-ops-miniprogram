// index.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
const { ZabbixAPI } = require('../../utils/zabbix.js')

Component({
  data: {
    motto: 'Hello World',
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickName: '',
    },
    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    canIUseNicknameComp: wx.canIUse('input.type.nickname'),
    // Zabbix 配置相关
    configList: [],
    showConfigModal: false,
    currentConfig: {
      id: '',
      name: '',
      apiUrl: '',
      token: ''
    },
    isEdit: false,
    testPassed: false,
    isTesting: false,
  },
  
  lifetimes: {
    attached() {
      this.loadConfigList()
    }
  },
  
  methods: {
    // 事件处理函数
    bindViewTap() {
      wx.navigateTo({
        url: '../logs/logs'
      })
    },
    onChooseAvatar(e) {
      console.log('onChooseAvatar', e)
      const { avatarUrl } = e.detail
      const { nickName } = this.data.userInfo
      this.setData({
        "userInfo.avatarUrl": avatarUrl,
        hasUserInfo: nickName && avatarUrl && avatarUrl !== defaultAvatarUrl,
      })
    },
    onInputChange(e) {
      console.log('onInputChange', e)
      const nickName = e.detail.value
      const { avatarUrl } = this.data.userInfo
      this.setData({
        "userInfo.nickName": nickName,
        hasUserInfo: nickName && avatarUrl && avatarUrl !== defaultAvatarUrl,
      })
    },
    getUserProfile(e) {
      console.log('getUserProfile', e)
      // 推荐使用wx.getUserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认，开发者妄善保管用户快速填写的头像昵称，避免重复弹窗
      wx.getUserProfile({
        desc: '展示用户信息', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
        success: (res) => {
          console.log(res)
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
        }
      })
    },
    
    // 加载配置列表
    loadConfigList() {
      const list = wx.getStorageSync('zabbix_config_list') || []
      this.setData({
        configList: list
      })
    },
    
    // 显示新增配置弹窗
    showAddConfig() {
      console.log('showAddConfig called')
      this.setData({
        showConfigModal: true,
        isEdit: false,
        testPassed: false,
        isTesting: false,
        currentConfig: {
          id: Date.now().toString(),
          name: '',
          apiUrl: '',
          token: ''
        }
      })
    },
    
    // 显示编辑配置弹窗
    showEditConfig(e) {
      const { index } = e.currentTarget.dataset
      const config = this.data.configList[index]
      this.setData({
        showConfigModal: true,
        isEdit: true,
        testPassed: false,
        isTesting: false,
        currentConfig: { ...config },
        editIndex: index
      })
    },
    
    // 关闭弹窗
    closeModal() {
      this.setData({
        showConfigModal: false,
        testPassed: false,
        isTesting: false
      })
    },
    
    // 配置名称输入
    onConfigNameInput(e) {
      this.setData({
        'currentConfig.name': e.detail.value
      })
    },
    
    // API URL 输入
    onApiUrlInput(e) {
      this.setData({
        'currentConfig.apiUrl': e.detail.value
      })
    },
    
    // Token 输入
    onTokenInput(e) {
      this.setData({
        'currentConfig.token': e.detail.value
      })
    },
    
    // 测试连接
    async testConnection() {
      const { currentConfig } = this.data
      
      if (!currentConfig.name) {
        wx.showToast({
          title: '请输入配置名称',
          icon: 'none'
        })
        return
      }
      
      if (!currentConfig.apiUrl) {
        wx.showToast({
          title: '请输入API地址',
          icon: 'none'
        })
        return
      }
      
      if (!currentConfig.token) {
        wx.showToast({
          title: '请输入Token',
          icon: 'none'
        })
        return
      }
      
      this.setData({
        isTesting: true
      })
      
      try {
        // 使用 ZabbixAPI 类测试连接
        const api = new ZabbixAPI(currentConfig.apiUrl, currentConfig.token)
        const result = await api.testConnection()
        
        this.setData({
          isTesting: false
        })
        
        if (result.success) {
          this.setData({
            testPassed: true
          })
          wx.showToast({
            title: `连接成功 (${result.version})`,
            icon: 'success',
            duration: 2000
          })
        } else {
          this.setData({
            testPassed: false
          })
          wx.showToast({
            title: result.message || '连接失败',
            icon: 'error',
            duration: 2000
          })
        }
      } catch (error) {
        console.error('Test connection error:', error)
        this.setData({
          isTesting: false,
          testPassed: false
        })
        wx.showToast({
          title: '连接失败',
          icon: 'error',
          duration: 2000
        })
      }
    },
    
    // 保存配置
    saveConfig() {
      const { currentConfig, isEdit, editIndex, configList } = this.data
      
      if (!currentConfig.name) {
        wx.showToast({
          title: '请输入配置名称',
          icon: 'none'
        })
        return
      }
      
      if (!currentConfig.apiUrl) {
        wx.showToast({
          title: '请输入API地址',
          icon: 'none'
        })
        return
      }
      
      if (!currentConfig.token) {
        wx.showToast({
          title: '请输入Token',
          icon: 'none'
        })
        return
      }
      
      let newList = [...configList]
      if (isEdit) {
        newList[editIndex] = currentConfig
      } else {
        newList.push(currentConfig)
      }
      
      wx.setStorageSync('zabbix_config_list', newList)
      
      this.setData({
        configList: newList,
        showConfigModal: false
      })
      
      wx.showToast({
        title: isEdit ? '修改成功' : '添加成功',
        icon: 'success'
      })
    },
    
    // 删除配置
    deleteConfig(e) {
      const { index } = e.currentTarget.dataset
      wx.showModal({
        title: '提示',
        content: '确定要删除此配置吗？',
        success: (res) => {
          if (res.confirm) {
            let newList = [...this.data.configList]
            newList.splice(index, 1)
            wx.setStorageSync('zabbix_config_list', newList)
            this.setData({
              configList: newList
            })
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
          }
        }
      })
    },
    
    // 设置为默认配置
    setDefaultConfig(e) {
      const { index } = e.currentTarget.dataset
      const config = this.data.configList[index]
      wx.setStorageSync('zabbix_default_config', config)
      wx.showToast({
        title: '已设为默认',
        icon: 'success'
      })
    },
  },
})
