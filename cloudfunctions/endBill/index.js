// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
const db = cloud.database()
// 云函数入口函数
function cal(groupUserList, projectList) {
  let [...result] = groupUserList

  // 每个结果增加一个shouldPay字段
  result.forEach(item => item.shouldPay = 0)

  projectList.forEach(project => {
    // 如果支付人和包含人一致，那就跳过这笔帐（project）
    if (project.containUser.length === 1 && project.containUser[0].openId === project.createBy.openId) {
      return
    }
    let inContainUser = false
    project.containUser.forEach(containUser => {
      groupUserList.forEach((groupUser, groupUserIndex) => {
        if (groupUser.openId === containUser.openId) {
          result[groupUserIndex].shouldPay = result[groupUserIndex].shouldPay - roundFun(Number(project.price) / project.containUser.length, 2)
        }
      })
      // 判断发起人是否包含账单情况的处理
      if (containUser.openId === project.createBy.openId) {
        inContainUser = true
        result.forEach(item => {
          if (item.openId === containUser.openId) {
            item.shouldPay = Number(project.price) + item.shouldPay
          }
        })
      }
    })
    // 如果发起人不在账单内，就把在账单内的人的这笔帐的钱的平均值全部被转给发起人
    if (!inContainUser) {
      result.forEach(item => {
        if (item.openId === project.createBy.openId) {
          item.shouldPay += roundFun(project.price / project.containUser.length, 2)
        }
      })
    }
  })
  result.forEach(item => {
    item.shouldPay = Math.floor(item.shouldPay * 100) / 100
  })
  return result
}
function roundFun(value, n) {
  return Math.round(value * Math.pow(10, n)) / Math.pow(10, n);
}
exports.main = async (event, context) => {
  const { groupUserList, currentBill, projectList, end} = event
  if (end) {
    const result = cal(groupUserList, projectList)
    await db.collection('bill').doc(currentBill._id).update({
      data: {
        ended: true,
        endTime: new Date(),
        result
      }
    })
  } else {
    await db.collection('bill').doc(currentBill._id).update({
      data: {
        ended: false
      }
    })
  }
}