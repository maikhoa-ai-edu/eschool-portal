-- Giai đoạn 8.6: chốt schema 0.10.0. Trình đóng gói gộp mọi migration tới dòng đặt phiên bản nên dòng này
-- nằm trong file cuối cùng của phiên bản.
update public.app_meta set value = '0.10.0', updated_at = now() where key = 'schema_version';
