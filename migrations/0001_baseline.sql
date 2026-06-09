CREATE TABLE users (
  id         TEXT    PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE questions (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  json_id TEXT    NOT NULL UNIQUE
);

CREATE TABLE answers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT    NOT NULL REFERENCES users(id),
  question_id    INTEGER NOT NULL REFERENCES questions(id),
  selected_label TEXT    NOT NULL,
  is_correct     INTEGER NOT NULL CHECK (is_correct IN (0,1)),
  duration       INTEGER          CHECK (duration IS NULL OR duration >= 0),
  created_at     INTEGER NOT NULL
);
CREATE INDEX idx_answers_user_question ON answers(user_id, question_id);
CREATE INDEX idx_answers_user_created  ON answers(user_id, created_at);


-- Seed questions (json_id) from app/data/exams-json/*.json
-- 180 distinct json_ids (sorted)

INSERT INTO questions (json_id) VALUES ('exam1-2013-q1'),('exam1-2013-q2'),('exam1-2013-q3'),('exam1-2013-q4'),('exam1-2013-q5'),('exam1-2014-q1'),('exam1-2014-q2'),('exam1-2014-q3'),('exam1-2014-q4'),('exam1-2014-q5'),('exam1-2015-q1'),('exam1-2015-q2'),('exam1-2015-q3'),('exam1-2015-q4'),('exam1-2015-q5'),('exam1-2016-q1'),('exam1-2016-q2'),('exam1-2016-q3'),('exam1-2016-q4'),('exam1-2016-q5'),('exam1-2017-q1'),('exam1-2017-q2'),('exam1-2017-q3'),('exam1-2017-q4'),('exam1-2017-q5'),('exam2-2013-q1'),('exam2-2013-q2'),('exam2-2013-q3'),('exam2-2013-q4'),('exam2-2013-q5'),('exam2-2014-q1'),('exam2-2014-q2'),('exam2-2014-q3'),('exam2-2014-q4'),('exam2-2014-q5'),('exam2-2015-q1'),('exam2-2015-q2'),('exam2-2015-q3'),('exam2-2015-q4'),('exam2-2015-q5'),('exam2-2016-q1'),('exam2-2016-q2'),('exam2-2016-q3'),('exam2-2016-q4'),('exam2-2016-q5'),('exam2-2017-q1'),('exam2-2017-q2'),('exam2-2017-q3'),('exam2-2017-q4'),('exam2-2017-q5'),('exam3-2013-q1'),('exam3-2013-q2'),('exam3-2013-q3'),('exam3-2013-q4'),('exam3-2013-q5'),('exam3-2015-q1'),('exam3-2015-q2'),('exam3-2015-q3'),('exam3-2015-q4'),('exam3-2015-q5'),('exam3-2016-q1'),('exam3-2016-q2'),('exam3-2016-q3'),('exam3-2016-q4'),('exam3-2016-q5'),('exam3-2017-q1'),('exam3-2017-q2'),('exam3-2017-q3'),('exam3-2017-q4'),('exam3-2017-q5'),('exam4-2013-q1'),('exam4-2013-q2'),('exam4-2013-q3'),('exam4-2013-q4'),('exam4-2013-q5'),('exam4-2014-q1'),('exam4-2014-q2'),('exam4-2014-q3'),('exam4-2014-q4'),('exam4-2014-q5'),('exam4-2015-q1'),('exam4-2015-q2'),('exam4-2015-q3'),('exam4-2015-q4'),('exam4-2015-q5'),('exam5-2013-q1'),('exam5-2013-q2'),('exam5-2013-q3'),('exam5-2013-q4'),('exam5-2013-q5'),('exam5-2015-q1'),('exam5-2015-q2'),('exam5-2015-q3'),('exam5-2015-q4'),('exam5-2015-q5'),('exam6-2013-q1'),('exam6-2013-q2'),('exam6-2013-q3'),('exam6-2013-q4'),('exam6-2013-q5');
INSERT INTO questions (json_id) VALUES ('exam6-2014-q1'),('exam6-2014-q2'),('exam6-2014-q3'),('exam6-2014-q4'),('exam6-2014-q5'),('exam6-2015-q1'),('exam6-2015-q2'),('exam6-2015-q3'),('exam6-2015-q4'),('exam6-2015-q5'),('exam6-2016-q1'),('exam6-2016-q2'),('exam6-2016-q3'),('exam6-2016-q4'),('exam6-2016-q5'),('exam6-2017-q1'),('exam6-2017-q2'),('exam6-2017-q3'),('exam6-2017-q4'),('exam6-2017-q5'),('exam7-2013-q1'),('exam7-2013-q2'),('exam7-2013-q3'),('exam7-2013-q4'),('exam7-2013-q5'),('exam7-2014-q1'),('exam7-2014-q2'),('exam7-2014-q3'),('exam7-2014-q4'),('exam7-2014-q5'),('exam7-2015-q1'),('exam7-2015-q2'),('exam7-2015-q3'),('exam7-2015-q4'),('exam7-2015-q5'),('exam7-2016-q1'),('exam7-2016-q2'),('exam7-2016-q3'),('exam7-2016-q4'),('exam7-2016-q5'),('exam7-2017-q1'),('exam7-2017-q2'),('exam7-2017-q3'),('exam7-2017-q4'),('exam7-2017-q5'),('exam8-2013-q1'),('exam8-2013-q2'),('exam8-2013-q3'),('exam8-2013-q4'),('exam8-2013-q5'),('exam8-2014-q1'),('exam8-2014-q2'),('exam8-2014-q3'),('exam8-2014-q4'),('exam8-2014-q5'),('exam8-2015-q1'),('exam8-2015-q2'),('exam8-2015-q3'),('exam8-2015-q4'),('exam8-2015-q5'),('exam8-2016-q1'),('exam8-2016-q2'),('exam8-2016-q3'),('exam8-2016-q4'),('exam8-2016-q5'),('exam8-2017-q1'),('exam8-2017-q2'),('exam8-2017-q3'),('exam8-2017-q4'),('exam8-2017-q5'),('exam9-2013-q1'),('exam9-2013-q2'),('exam9-2013-q3'),('exam9-2013-q4'),('exam9-2013-q5'),('exam9-2014-q1'),('exam9-2014-q2'),('exam9-2014-q3'),('exam9-2014-q4'),('exam9-2014-q5');
