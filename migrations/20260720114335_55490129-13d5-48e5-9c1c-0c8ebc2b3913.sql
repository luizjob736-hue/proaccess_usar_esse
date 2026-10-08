
CREATE POLICY "chamados_bucket_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chamados');
CREATE POLICY "chamados_bucket_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chamados' AND owner = auth.uid());
CREATE POLICY "chamados_bucket_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chamados' AND (owner = auth.uid() OR public.is_admin(auth.uid())));
