-- =============================================================================
-- Migration 004: Neurological Exam Options Seed Data
-- =============================================================================
-- Populates the 20 neuro option lookup tables used by the neurological
-- examination section of the consultation form.
-- Safe to re-run (INSERT ... ON CONFLICT DO NOTHING).
-- =============================================================================

-- Motor Function
INSERT INTO motor_function_options (value) VALUES
  ('Normal'), ('Mild Weakness'), ('Moderate Weakness'), ('Severe Weakness'),
  ('Plegia'), ('Hemiplegia'), ('Paraplegia'), ('Monoplegia'), ('Quadriplegia'),
  ('Hyperkinesia'), ('Hypokinesia'), ('Spastic Weakness'), ('Flaccid Weakness')
ON CONFLICT DO NOTHING;

-- Muscle Tone
INSERT INTO muscle_tone_options (value) VALUES
  ('Normal'), ('Hypertonia'), ('Hypotonia'), ('Spasticity'), ('Rigidity'),
  ('Flaccidity'), ('Clasp-knife Rigidity'), ('Lead-pipe Rigidity'),
  ('Cogwheel Rigidity'), ('Decerebrate Rigidity'), ('Decorticate Rigidity')
ON CONFLICT DO NOTHING;

-- Muscle Strength
INSERT INTO muscle_strength_options (value) VALUES
  ('5/5 - Normal'), ('4/5 - Active movement against some resistance'),
  ('3/5 - Active movement against gravity'), ('2/5 - Active movement with gravity eliminated'),
  ('1/5 - Trace contraction'), ('0/5 - No contraction'),
  ('4+/5'), ('4-/5'), ('3+/5'), ('Symmetrical'), ('Asymmetrical')
ON CONFLICT DO NOTHING;

-- Deep Tendon Reflexes
INSERT INTO deep_tendon_reflexes_options (value) VALUES
  ('Normal (2+)'), ('Absent (0)'), ('Diminished (1+)'), ('Brisk (3+)'),
  ('Clonus (4+)'), ('Hyperreflexia'), ('Hyporeflexia'), ('Areflexia'),
  ('Symmetrical'), ('Asymmetrical'), ('Biceps Normal'), ('Triceps Normal'),
  ('Knee Jerk Normal'), ('Ankle Jerk Normal'), ('Biceps Absent'),
  ('Knee Jerk Absent'), ('Ankle Jerk Absent')
ON CONFLICT DO NOTHING;

-- Plantar Reflex
INSERT INTO plantar_reflex_options (value) VALUES
  ('Flexor (Normal)'), ('Extensor (Babinski Positive)'), ('Equivocal'),
  ('Absent'), ('Bilateral Flexor'), ('Bilateral Extensor'),
  ('Right Extensor'), ('Left Extensor'), ('Withdrawal Response')
ON CONFLICT DO NOTHING;

-- Pupillary Reaction
INSERT INTO pupillary_reaction_options (value) VALUES
  ('Equal and Reactive'), ('Unequal'), ('Fixed and Dilated'), ('Fixed and Constricted'),
  ('Sluggish Reaction'), ('RAPD (Relative Afferent Pupillary Defect)'),
  ('Miosis'), ('Mydriasis'), ('Anisocoria'), ('Brisk Reaction'),
  ('No Reaction'), ('Left Sluggish'), ('Right Sluggish')
ON CONFLICT DO NOTHING;

-- Speech Assessment
INSERT INTO speech_assessment_options (value) VALUES
  ('Normal'), ('Dysarthria'), ('Aphasia'), ('Expressive Aphasia'),
  ('Receptive Aphasia'), ('Mixed Aphasia'), ('Dysphonia'), ('Slurred Speech'),
  ('Scanning Speech'), ('Monotone Speech'), ('Apraxia of Speech'),
  ('Stuttering'), ('Mute'), ('Hoarse Voice')
ON CONFLICT DO NOTHING;

-- Gait Assessment
INSERT INTO gait_assessment_options (value) VALUES
  ('Normal'), ('Ataxic Gait'), ('Hemiplegic Gait'), ('Spastic Gait'),
  ('Steppage Gait'), ('Antalgic Gait'), ('Trendelenburg Gait'),
  ('Scissor Gait'), ('Parkinsonian Gait (Festinating)'), ('Waddling Gait'),
  ('Magnetic Gait'), ('Unable to Walk'), ('Wide-based Gait'), ('Cautious Gait')
ON CONFLICT DO NOTHING;

-- Coordination
INSERT INTO coordination_options (value) VALUES
  ('Normal'), ('Dysmetria'), ('Past-pointing'), ('Dysdiadochokinesia'),
  ('Intention Tremor'), ('Ataxia'), ('Cerebellar Ataxia'), ('Sensory Ataxia'),
  ('Mild Incoordination'), ('Severe Incoordination'), ('Heel-shin Inaccurate'),
  ('Finger-nose Inaccurate'), ('Finger-nose Normal'), ('Heel-shin Normal')
ON CONFLICT DO NOTHING;

-- Sensory Examination
INSERT INTO sensory_examination_options (value) VALUES
  ('Normal'), ('Reduced Sensation'), ('Absent Sensation'), ('Hyperesthesia'),
  ('Paresthesia'), ('Numbness'), ('Pain Sensation Reduced'),
  ('Vibration Reduced'), ('Proprioception Impaired'), ('Dermatomal Pattern'),
  ('Glove and Stocking Pattern'), ('Hemibody Loss'), ('Normal Bilaterally')
ON CONFLICT DO NOTHING;

-- Cranial Nerves
INSERT INTO cranial_nerves_options (value) VALUES
  ('Intact'), ('I - Olfactory Intact'), ('II - Visual Acuity Normal'),
  ('III - Oculomotor Normal'), ('IV - Trochlear Normal'), ('V - Trigeminal Normal'),
  ('VI - Abducens Normal'), ('VII - Facial Normal'), ('VIII - Auditory Normal'),
  ('IX - Glossopharyngeal Normal'), ('X - Vagus Normal'), ('XI - Accessory Normal'),
  ('XII - Hypoglossal Normal'), ('III Palsy'), ('VI Palsy'), ('VII Palsy'),
  ('Multiple Cranial Nerve Palsy'), ('All Cranial Nerves Intact')
ON CONFLICT DO NOTHING;

-- Mental Status
INSERT INTO mental_status_options (value) VALUES
  ('Alert and Oriented'), ('Confused'), ('Disoriented to Time'),
  ('Disoriented to Place'), ('Disoriented to Person'), ('Drowsy'),
  ('Stuporous'), ('Comatose'), ('Agitated'), ('Anxious'),
  ('Depressed Affect'), ('Flat Affect'), ('Oriented x3'), ('Oriented x2'),
  ('Memory Impaired'), ('Intact'), ('Delirium')
ON CONFLICT DO NOTHING;

-- Cerebellar Function
INSERT INTO cerebellar_function_options (value) VALUES
  ('Normal'), ('Impaired'), ('Dysmetria Present'), ('Dysdiadochokinesia Present'),
  ('Intention Tremor Present'), ('Nystagmus Present'), ('Tandem Walking Impaired'),
  ('Romberg Positive'), ('Romberg Negative'), ('Ataxia'),
  ('Finger-nose Inaccurate'), ('Heel-shin Inaccurate'), ('All Normal')
ON CONFLICT DO NOTHING;

-- Muscle Wasting
INSERT INTO muscle_wasting_options (value) VALUES
  ('None'), ('Mild'), ('Moderate'), ('Severe'), ('Global Wasting'),
  ('Focal Wasting'), ('Thenar Wasting'), ('Hypothenar Wasting'),
  ('Distal Wasting'), ('Proximal Wasting'), ('Bilateral'), ('Unilateral'),
  ('Symmetrical'), ('Asymmetrical')
ON CONFLICT DO NOTHING;

-- Abnormal Movements
INSERT INTO abnormal_movements_options (value) VALUES
  ('None'), ('Tremor'), ('Resting Tremor'), ('Intention Tremor'),
  ('Postural Tremor'), ('Chorea'), ('Athetosis'), ('Ballismus'),
  ('Hemiballismus'), ('Myoclonus'), ('Tics'), ('Dystonia'),
  ('Fasciculations'), ('Clonus'), ('Spasms')
ON CONFLICT DO NOTHING;

-- Romberg Test
INSERT INTO romberg_test_options (value) VALUES
  ('Negative (Normal)'), ('Positive'), ('Unable to Assess'), ('Not Tested'),
  ('Positive with Eyes Open'), ('Positive with Eyes Closed only'),
  ('Mild Sway'), ('Significant Sway'), ('Falls without support')
ON CONFLICT DO NOTHING;

-- Nystagmus
INSERT INTO nystagmus_options (value) VALUES
  ('Absent'), ('Present'), ('Horizontal Nystagmus'), ('Vertical Nystagmus'),
  ('Rotatory Nystagmus'), ('Gaze-evoked Nystagmus'), ('Downbeat Nystagmus'),
  ('Upbeat Nystagmus'), ('Pendular Nystagmus'), ('Bidirectional'),
  ('Unidirectional'), ('Bilateral')
ON CONFLICT DO NOTHING;

-- Fundoscopy
INSERT INTO fundoscopy_options (value) VALUES
  ('Normal'), ('Papilledema'), ('Optic Atrophy'), ('Hypertensive Retinopathy'),
  ('Diabetic Retinopathy'), ('AV Nipping'), ('Flame Hemorrhages'),
  ('Disc Pallor'), ('Cup-Disc Ratio Increased'), ('Normal Disc'),
  ('Cotton Wool Spots'), ('Drusen'), ('Not Performed')
ON CONFLICT DO NOTHING;

-- Straight Leg Raise Left
INSERT INTO straight_leg_raise_left_options (value) VALUES
  ('Negative'), ('Positive at 30°'), ('Positive at 45°'), ('Positive at 60°'),
  ('Positive at 70°'), ('Positive at 90°'), ('Positive (angle not documented)'),
  ('Unable to Assess'), ('Not Tested')
ON CONFLICT DO NOTHING;

-- Straight Leg Raise Right
INSERT INTO straight_leg_raise_right_options (value) VALUES
  ('Negative'), ('Positive at 30°'), ('Positive at 45°'), ('Positive at 60°'),
  ('Positive at 70°'), ('Positive at 90°'), ('Positive (angle not documented)'),
  ('Unable to Assess'), ('Not Tested')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- VERIFICATION
-- SELECT table_name, (SELECT COUNT(*) FROM information_schema.columns WHERE ...)
-- Run these to check:
-- SELECT 'motor_function_options' AS t, COUNT(*) FROM motor_function_options
-- UNION ALL SELECT 'muscle_tone_options', COUNT(*) FROM muscle_tone_options
-- UNION ALL SELECT 'muscle_strength_options', COUNT(*) FROM muscle_strength_options
-- UNION ALL SELECT 'deep_tendon_reflexes_options', COUNT(*) FROM deep_tendon_reflexes_options
-- UNION ALL SELECT 'plantar_reflex_options', COUNT(*) FROM plantar_reflex_options
-- UNION ALL SELECT 'pupillary_reaction_options', COUNT(*) FROM pupillary_reaction_options
-- UNION ALL SELECT 'speech_assessment_options', COUNT(*) FROM speech_assessment_options
-- UNION ALL SELECT 'gait_assessment_options', COUNT(*) FROM gait_assessment_options
-- UNION ALL SELECT 'coordination_options', COUNT(*) FROM coordination_options
-- UNION ALL SELECT 'sensory_examination_options', COUNT(*) FROM sensory_examination_options
-- UNION ALL SELECT 'cranial_nerves_options', COUNT(*) FROM cranial_nerves_options
-- UNION ALL SELECT 'mental_status_options', COUNT(*) FROM mental_status_options
-- UNION ALL SELECT 'cerebellar_function_options', COUNT(*) FROM cerebellar_function_options
-- UNION ALL SELECT 'muscle_wasting_options', COUNT(*) FROM muscle_wasting_options
-- UNION ALL SELECT 'abnormal_movements_options', COUNT(*) FROM abnormal_movements_options
-- UNION ALL SELECT 'romberg_test_options', COUNT(*) FROM romberg_test_options
-- UNION ALL SELECT 'nystagmus_options', COUNT(*) FROM nystagmus_options
-- UNION ALL SELECT 'fundoscopy_options', COUNT(*) FROM fundoscopy_options
-- UNION ALL SELECT 'straight_leg_raise_left_options', COUNT(*) FROM straight_leg_raise_left_options
-- UNION ALL SELECT 'straight_leg_raise_right_options', COUNT(*) FROM straight_leg_raise_right_options;
-- =============================================================================
