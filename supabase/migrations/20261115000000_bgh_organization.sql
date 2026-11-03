-- Ban giám hiệu mang toàn bộ quyền của ADMIN (xem 20261109800000_staff_groups.sql), nhưng quyền
-- organization.manage thêm ở 0.11.0 chỉ được cấp cho SUPER_ADMIN và ADMIN. Cấp bù cho Ban giám hiệu.
insert into public.role_permissions (role, permission)
select 'BAN_GIAM_HIEU', permission from public.role_permissions where role = 'ADMIN'
on conflict do nothing;
