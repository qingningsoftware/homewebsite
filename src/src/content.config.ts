// 内容集合定义：products 集合（6 个产品页，man 手册结构）。
// banner / icon 字段存文件名（如 smart-community.png），由消费方（T5/T8）负责解析到 src/assets/。
import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { glob } from 'astro/loaders'

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: z.object({
    /** 产品短名（列表/表格展示用） */
    name: z.string(),
    /** 产品页标题（智慧社区用品牌名「智尚通行 · 智慧社区平台」） */
    title: z.string(),
    /** 一句话定位（NAME 段） */
    oneLiner: z.string(),
    /** 适用对象（SYNOPSIS 段） */
    audience: z.string(),
    /** 部署形态（SYNOPSIS 段） */
    deploy: z.string(),
    /** 核心功能清单（FEATURES 段，5–8 条） */
    features: z.array(z.string()),
    /** 常见问答（3–5 条，页面可见内容 + JSON-LD FAQPage 双渲染） */
    faq: z.array(z.object({ q: z.string(), a: z.string() })),
    /** banner 图片文件名（位于 src/assets/banners/） */
    banner: z.string(),
    /** 图标文件名（位于 src/assets/icons/），无图标则为空串 */
    icon: z.string(),
    /** 上线年份（首页进程列表 PID 列展示） */
    year: z.number(),
    /** 展示排序（1 起，越小越靠前） */
    order: z.number(),
  }),
})

export const collections = { products }
