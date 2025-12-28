-- Atualizar a função handle_new_user para incluir o email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, cpf, birth_date, phone, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'cpf', ''),
    COALESCE((new.raw_user_meta_data->>'birth_date')::date, CURRENT_DATE),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    new.email
  );
  RETURN new;
END;
$function$;