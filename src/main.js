/* ============================================================
 * src/main.js — 三餐营养师：客户端注册
 * 与 card.js / panel.js 共用一个工厂作用域（React、h 由外层提供）。
 * 只做两件事：注册整页主面板（key 与侧栏 id 相同）和侧栏图标入口。
 * 无 import/export，无模块级副作用。
 * ============================================================ */

/** 需要的客户端服务。 */
const inject = ['slots'];

/**
 * 注册主面板与侧栏入口。
 * @param {object} ctx 客户端根上下文
 * @returns {void}
 */
function panelApply(ctx) {
  ctx.slots.inject('main', function () {
    return ctx.slots.register(
      { name: 'main', key: 'nutrition-desk' },
      NutritionPanel
    );
  });
  ctx.effect(function () {
    return ctx.slots.inject('sidebar.panellist', function () {
      return ctx.slots.register(
        {
          name: 'sidebar.panellist',
          id: 'nutrition-desk',
          order: 7,
          label: function () { return '三餐营养师'; },
        },
        PanelIcon
      );
    });
  }, 'nutrition-desk: sidebar entry');
}
