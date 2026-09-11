# Fork 同步纪律：最小品牌化，上游语义零改动

HAgents 是 lukilabs/craft-agents-oss（Apache-2.0）的 fork，`upstream` remote 永久保留、定期合流。因此品牌化只做产品面（README 归属段、本 fork 的 docs/），内部包名、`CRAFT_*` 环境变量、`~/.craft-agent` 数据目录与上游行为语义零改动；原创能力一律放新目录或独立包，改写上游文件仅限修 bug。任何「顺手重命名」都会把每次上游同步变成手工合并灾难——这是 fork 价值的对价。

分发与改造必须保留根目录 `LICENSE` 与 `NOTICE`。
