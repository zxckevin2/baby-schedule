// 云同步配置
// 已接入：腾讯云开发 CloudBase（PostgreSQL / PG 模式）
export const CLOUD = {
  enabled: true,
  envId: 'test-d1g3g6gt9f1f0cd0c',
  region: 'ap-shanghai',
  // 实时推送(Postgres CDC / WebSocket)。当前环境返回 503，说明未开通实时推送。
  // 若在 CloudBase 控制台开通“实时推送”后，把这里改成 true 即可获得秒级推送；否则靠轮询。
  realtime: false
};
