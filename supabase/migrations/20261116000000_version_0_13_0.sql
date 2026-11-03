-- Chốt schema 0.13.0. Trình đóng gói gộp mọi migration tới dòng đặt phiên bản nên dòng này
-- nằm trong file cuối cùng của phiên bản.
update public.app_meta set value = '0.13.0', updated_at = now() where key = 'schema_version';
