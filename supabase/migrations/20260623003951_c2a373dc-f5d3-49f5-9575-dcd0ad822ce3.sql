
DO $$
DECLARE
  v_event_id uuid := '669ee2fc-f758-44da-87d9-0969b696dea2';
  v_template_id uuid;
  v_section_id uuid;
  v_parent_id uuid;
BEGIN
  INSERT INTO public.scoring_templates (name, description, event_id, is_default, is_locked)
  VALUES ('USASF L4 Junior - Medium (Sample)',
          'Sample template seeded from Division Score Report PDF. Panels: J1=Building, J2=Tumbling, J3=Choreography.',
          v_event_id, false, false)
  RETURNING id INTO v_template_id;

  INSERT INTO public.scoring_sections
    (template_id, name, abbreviation, description, max_points, default_panel_abbreviation, display_order)
  VALUES (v_template_id, 'Performance', 'PERF', 'Routine performance scoring', 50, 'ALL', 0)
  RETURNING id INTO v_section_id;

  -- J1 Building Panel
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Stunt', 8.5, 'main', 'J1', 0, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 4.5, 'difficulty', 'J1', 0, 1),
    (v_template_id, v_section_id, v_parent_id, 'Execution', 4.0, 'execution', 'J1', 1, 1);

  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Stunt Degree of Difficulty Driver', 0.8, 'driver', 'J1', 1, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 0.8, 'difficulty', 'J1', 0, 1);

  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Stunt Max Participation Driver', 0.7, 'driver', 'J1', 2, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 0.7, 'difficulty', 'J1', 0, 1);

  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Pyramid', 8.0, 'main', 'J1', 3, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 4.0, 'difficulty', 'J1', 0, 1),
    (v_template_id, v_section_id, v_parent_id, 'Execution', 4.0, 'execution', 'J1', 1, 1);

  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Tosses', 4.0, 'main', 'J1', 4, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 2.0, 'difficulty', 'J1', 0, 1),
    (v_template_id, v_section_id, v_parent_id, 'Execution', 2.0, 'execution', 'J1', 1, 1);

  -- J2 Tumbling Panel
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Standing Tumbling', 7.0, 'main', 'J2', 5, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 3.0, 'difficulty', 'J2', 0, 1),
    (v_template_id, v_section_id, v_parent_id, 'Execution', 4.0, 'execution', 'J2', 1, 1);

  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Standing Tumbling Degree of Difficulty', 1.0, 'driver', 'J2', 6, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 1.0, 'difficulty', 'J2', 0, 1);

  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Running Tumbling', 7.0, 'main', 'J2', 7, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 3.0, 'difficulty', 'J2', 0, 1),
    (v_template_id, v_section_id, v_parent_id, 'Execution', 4.0, 'execution', 'J2', 1, 1);

  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Running Tumbling Degree of Difficulty', 0.5, 'driver', 'J2', 8, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 0.5, 'difficulty', 'J2', 0, 1);

  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Running Tumbling Max Participation', 0.5, 'driver', 'J2', 9, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 0.5, 'difficulty', 'J2', 0, 1);

  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Jumps', 4.0, 'main', 'J2', 10, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 2.0, 'difficulty', 'J2', 0, 1),
    (v_template_id, v_section_id, v_parent_id, 'Execution', 2.0, 'execution', 'J2', 1, 1);

  -- J3 Choreography Panel
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Routine Creativity', 2.0, 'main', 'J3', 11, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 2.0, 'difficulty', 'J3', 0, 1);

  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Formations & Transitions', 2.0, 'main', 'J3', 12, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 2.0, 'difficulty', 'J3', 0, 1);

  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Dance', 2.0, 'main', 'J3', 13, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 1.0, 'difficulty', 'J3', 0, 1),
    (v_template_id, v_section_id, v_parent_id, 'Execution', 1.0, 'execution', 'J3', 1, 1);

  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight)
  VALUES (v_template_id, v_section_id, NULL, 'Showmanship', 2.0, 'main', 'J3', 14, 1) RETURNING id INTO v_parent_id;
  INSERT INTO public.scoring_categories (template_id, section_id, parent_category_id, name, max_points, category_type, panel_abbreviation, display_order, weight) VALUES
    (v_template_id, v_section_id, v_parent_id, 'Difficulty', 2.0, 'difficulty', 'J3', 0, 1);

  -- Deduction types
  INSERT INTO public.deduction_types (template_id, name, points, description, category, display_order) VALUES
    (v_template_id, 'Athlete Fall', 0.15, NULL, 'athlete', 0),
    (v_template_id, 'Major Athlete Fall', 0.25, NULL, 'athlete', 1),
    (v_template_id, 'Building Bobble', 0.25, NULL, 'building', 2),
    (v_template_id, 'Building Fall', 0.75, NULL, 'building', 3),
    (v_template_id, 'Major Building Fall', 1.25, NULL, 'building', 4),
    (v_template_id, 'Boundary Violation', 0.05, NULL, 'rule_violation', 5),
    (v_template_id, 'Time Limit Violation', 0.05, NULL, 'rule_violation', 6),
    (v_template_id, 'Image Policy - USASF Uniform Top Guidelines', 0.01, NULL, 'rule_violation', 7),
    (v_template_id, 'Image Policy - APS', 0.25, NULL, 'rule_violation', 8),
    (v_template_id, 'General Rules/Out of Level Tumbling', 0.05, NULL, 'legality', 9),
    (v_template_id, 'Building Out of Level', 0.10, NULL, 'legality', 10),
    (v_template_id, 'All Level Rules/Skill Restrictions by Division', 0.50, NULL, 'legality', 11),
    (v_template_id, 'Division Violation', 5.00, NULL, 'legality', 12);
END $$;
