export const users = [
  { id: "admin", name: "管理员", role: "admin", password: "admin123" },
  { id: "wang", name: "王老师", role: "user", password: "wanglab01" },
  { id: "cell", name: "细胞组", role: "user", password: "cell01" },
  { id: "chen", name: "陈同学", role: "user", password: "chen01" }
];

export const db = {
  consumables: [
    {
      id: "tip-10",
      name: "10 uL 吸头",
      catalog: "TF-10-R",
      spec: "10 uL, 带滤芯, 盒装",
      storage: "室温干燥",
      usages: ["分子实验室", "PCR区"],
      min: 8,
      locations: [
        { name: "库房1", qty: 18, unit: "箱" },
        { name: "分子实验室", qty: 6, unit: "盒" },
        { name: "PCR区", qty: 4, unit: "盒" }
      ]
    },
    {
      id: "tube-15",
      name: "1.5 mL 离心管",
      catalog: "MCT-150-C",
      spec: "无酶, 500支/包",
      storage: "室温",
      usages: ["细胞房", "分子实验室", "蛋白实验室"],
      min: 10,
      locations: [
        { name: "库房1", qty: 12, unit: "包" },
        { name: "细胞房", qty: 3, unit: "包" },
        { name: "分子实验室", qty: 5, unit: "包" }
      ]
    },
    {
      id: "plate-96",
      name: "96孔细胞培养板",
      catalog: "TCP-96-F",
      spec: "平底, TC处理",
      storage: "室温",
      usages: ["细胞房"],
      min: 3,
      locations: [
        { name: "库房1", qty: 7, unit: "箱" },
        { name: "细胞房", qty: 2, unit: "包" }
      ]
    },
    {
      id: "glove-m",
      name: "丁腈手套 M号",
      catalog: "NG-M-100",
      spec: "100只/盒",
      storage: "室温",
      usages: ["公共", "细胞房", "分子实验室"],
      min: 6,
      locations: [
        { name: "库房1", qty: 20, unit: "盒" },
        { name: "实验室入口", qty: 3, unit: "盒" }
      ]
    }
  ],
  freezers: [
    {
      id: "f80-01",
      name: "-80一号冰箱",
      temperature: "-80 C",
      shelves: 4,
      stacksPerShelf: 4,
      rackLevels: 4,
      rackDepth: 5
    }
  ],
  samples: [
    {
      id: "s1",
      name: "293T P12",
      type: "细胞冻存管",
      count: 6,
      ownerUserId: "wang",
      createdByUserId: "wang",
      status: "在库",
      project: "细胞模型",
      freezerId: "f80-01",
      shelf: 3,
      stack: "B",
      rackLevel: 2,
      depth: 4,
      box: "Box-B24",
      wells: "A1-A6",
      note: "2026-05-12 冻存"
    },
    {
      id: "s2",
      name: "Cas9 plasmid batch 06",
      type: "质粒",
      count: 10,
      ownerUserId: "chen",
      createdByUserId: "chen",
      status: "在库",
      project: "基因编辑",
      freezerId: "f80-01",
      shelf: 2,
      stack: "D",
      rackLevel: 1,
      depth: 2,
      box: "Box-D12",
      wells: "C1-D5",
      note: "甘油菌备份"
    },
    {
      id: "s3",
      name: "Jurkat stimulation RNA",
      type: "RNA",
      count: 8,
      ownerUserId: "cell",
      createdByUserId: "cell",
      status: "在库",
      project: "免疫刺激",
      freezerId: "f80-01",
      shelf: 4,
      stack: "A",
      rackLevel: 3,
      depth: 5,
      box: "Box-A35",
      wells: "E1-E8",
      note: "避免反复冻融"
    }
  ],
  operations: []
};

export function publicUsers() {
  return users.map(({ password, ...user }) => user);
}
