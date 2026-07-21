CREATE OR REPLACE FUNCTION public.validate_persona_lab_project_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  project_country text;
  segment_country text;
  segment_project uuid;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    SELECT country_code INTO project_country
    FROM public.persona_projects
    WHERE id = NEW.project_id;

    IF project_country IS NULL THEN
      RAISE EXCEPTION 'research program does not exist';
    END IF;

    IF project_country <> NEW.country_code THEN
      RAISE EXCEPTION 'research program does not belong to this country';
    END IF;
  END IF;

  IF NEW.segment_id IS NOT NULL THEN
    SELECT country_code, project_id INTO segment_country, segment_project
    FROM public.persona_segments
    WHERE id = NEW.segment_id;

    IF segment_country IS NULL THEN
      RAISE EXCEPTION 'segment does not exist';
    END IF;

    IF segment_country <> NEW.country_code THEN
      RAISE EXCEPTION 'segment does not belong to this country';
    END IF;

    IF NEW.project_id IS NOT NULL AND segment_project IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'segment does not belong to this research program';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_persona_lab_project_scope_on_studies ON public.studies;
CREATE TRIGGER validate_persona_lab_project_scope_on_studies
BEFORE INSERT OR UPDATE OF country_code, project_id, segment_id
ON public.studies
FOR EACH ROW
EXECUTE FUNCTION public.validate_persona_lab_project_scope();

CREATE OR REPLACE FUNCTION public.validate_persona_segment_member_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  persona_country text;
  segment_country text;
BEGIN
  SELECT country_code INTO persona_country
  FROM public.personas
  WHERE id = NEW.persona_id;

  SELECT country_code INTO segment_country
  FROM public.persona_segments
  WHERE id = NEW.segment_id;

  IF persona_country IS NULL THEN
    RAISE EXCEPTION 'persona does not exist';
  END IF;

  IF segment_country IS NULL THEN
    RAISE EXCEPTION 'segment does not exist';
  END IF;

  IF persona_country <> segment_country THEN
    RAISE EXCEPTION 'persona and segment must belong to the same country';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_persona_segment_member_scope_on_members ON public.persona_segment_members;
CREATE TRIGGER validate_persona_segment_member_scope_on_members
BEFORE INSERT OR UPDATE OF persona_id, segment_id
ON public.persona_segment_members
FOR EACH ROW
EXECUTE FUNCTION public.validate_persona_segment_member_scope();