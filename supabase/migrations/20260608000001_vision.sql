-- =====================================================================
-- Phase 2 이미지 비전 분석 (D-022)
-- content_analysis 에 시각 요소 분석 결과(visual_notes) 컬럼 추가.
-- 이미지(image/carousel=media_url, video/reel=thumbnail)를 캡션과 함께 분석한 결과.
-- =====================================================================
alter table public.analyze_insta_content_analysis
  add column if not exists visual_notes text;
