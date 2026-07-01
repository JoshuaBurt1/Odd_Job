--
-- PostgreSQL database dump
--

\restrict r2TZMTUF1TTFeKD8AaFhcBZ2rhfPDRozZangXRv5bOOSJD3JeDMhTktnmfCkfch

-- Dumped from database version 17.10
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public."Review" DROP CONSTRAINT IF EXISTS "Review_workerId_fkey";
ALTER TABLE IF EXISTS ONLY public."Review" DROP CONSTRAINT IF EXISTS "Review_seekerId_fkey";
ALTER TABLE IF EXISTS ONLY public."Review" DROP CONSTRAINT IF EXISTS "Review_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."Review" DROP CONSTRAINT IF EXISTS "Review_authorId_fkey";
ALTER TABLE IF EXISTS ONLY public."Job" DROP CONSTRAINT IF EXISTS "Job_workerId_fkey";
ALTER TABLE IF EXISTS ONLY public."Job" DROP CONSTRAINT IF EXISTS "Job_seekerId_fkey";
ALTER TABLE IF EXISTS ONLY public."CompletedJob" DROP CONSTRAINT IF EXISTS "CompletedJob_workerId_fkey";
ALTER TABLE IF EXISTS ONLY public."CompletedJob" DROP CONSTRAINT IF EXISTS "CompletedJob_seekerId_fkey";
DROP INDEX IF EXISTS public."User_email_key";
DROP INDEX IF EXISTS public."Job_paypalCaptureId_key";
DROP INDEX IF EXISTS public."CompletedJob_paypalCaptureId_key";
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE IF EXISTS ONLY public."Review" DROP CONSTRAINT IF EXISTS "Review_pkey";
ALTER TABLE IF EXISTS ONLY public."Job" DROP CONSTRAINT IF EXISTS "Job_pkey";
ALTER TABLE IF EXISTS ONLY public."CompletedJob" DROP CONSTRAINT IF EXISTS "CompletedJob_pkey";
DROP TABLE IF EXISTS public."User";
DROP TABLE IF EXISTS public."Review";
DROP TABLE IF EXISTS public."Job";
DROP TABLE IF EXISTS public."CompletedJob";
DROP TYPE IF EXISTS public."JobType";
DROP TYPE IF EXISTS public."JobStatus";
-- *not* dropping schema, since initdb creates it
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: JobStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."JobStatus" AS ENUM (
    'OPEN',
    'ACCEPTED',
    'AWAITING_EVALUATION'
);


--
-- Name: JobType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."JobType" AS ENUM (
    'WEBSITE_BUILDING',
    'MOBILE_APP_DEVELOPMENT',
    'DATA_ANNOTATION',
    'AI_MODEL_TRAINING',
    'GAME_DEVELOPMENT',
    'CROP_PICKING',
    'TRASH_CLEANUP',
    'LARGE_ITEM_DISPOSAL',
    'GRASS_CUTTING',
    'GARDEN_TENDING',
    'DECK_FENCE_BUILDING',
    'PACKAGE_DELIVERY',
    'TAXI_SERVICE'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: CompletedJob; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CompletedJob" (
    id text NOT NULL,
    title text NOT NULL,
    type public."JobType" NOT NULL,
    description text NOT NULL,
    price double precision NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    "seekerId" text NOT NULL,
    "workerId" text NOT NULL,
    "originalCreatedAt" timestamp(3) with time zone NOT NULL,
    "completedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "paypalCaptureId" text
);


--
-- Name: Job; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Job" (
    id text NOT NULL,
    title text NOT NULL,
    type public."JobType" NOT NULL,
    description text NOT NULL,
    price double precision NOT NULL,
    status public."JobStatus" DEFAULT 'OPEN'::public."JobStatus" NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    "startDate" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiryDate" timestamp(3) with time zone NOT NULL,
    "evaluationStartedAt" timestamp(3) with time zone,
    address text,
    lat double precision,
    lng double precision,
    radius double precision,
    "seekerId" text NOT NULL,
    "workerId" text,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL,
    "paypalCaptureId" text
);


--
-- Name: Review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Review" (
    id text NOT NULL,
    rating integer NOT NULL,
    comment text,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "jobId" text NOT NULL,
    "authorId" text NOT NULL,
    "seekerId" text,
    "workerId" text
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    "paymentId" text,
    address text,
    "userLat" double precision,
    "userLong" double precision,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "seekerRating" double precision DEFAULT 0 NOT NULL,
    "seekerReviewCount" integer DEFAULT 0 NOT NULL,
    "workerRating" double precision DEFAULT 0 NOT NULL,
    "workerReviewCount" integer DEFAULT 0 NOT NULL
);


--
-- Data for Name: CompletedJob; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CompletedJob" (id, title, type, description, price, timezone, "seekerId", "workerId", "originalCreatedAt", "completedAt", "paypalCaptureId") FROM stdin;
\.


--
-- Data for Name: Job; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Job" (id, title, type, description, price, status, timezone, "startDate", "expiryDate", "evaluationStartedAt", address, lat, lng, radius, "seekerId", "workerId", "createdAt", "updatedAt", "paypalCaptureId") FROM stdin;
a16b9b34-f214-4bfb-b745-7c5190a7a34c	Basically make an AI model to run Tim Hortons 24/7	AI_MODEL_TRAINING	Hardware provided from Skynet. Model must be trained in: making coffee, preparing food items, taking orders, serving food items, and monetary exchange.	3410	OPEN	America/New_York	2026-05-11 03:13:00+00	2026-06-09 03:41:00+00	\N	Tim Hortons, 533 Bayfield Street, Barrie, ON L4M, Canada	44.4152252	-79.711816	119	c0907ab1-9007-4944-afe6-45bb11b61341	\N	2026-05-11 03:18:04.572+00	2026-05-12 22:36:11.421+00	0EC19099158168949
aa0ace74-ed2b-4702-96d9-91103a4685f2	Need a PSW model trained ASAP	AI_MODEL_TRAINING	We will provide the hardware. Model must be trained in the following skills: bed making, laundry, cleaning, and assisted living tasks.	3410	OPEN	America/New_York	2026-05-11 03:18:00+00	2026-09-06 03:41:00+00	\N	Roberta Place Retirement Lodge, 489 Essa Road, Barrie, ON L4N, Canada	44.3427768	-79.7075458	143	037af7ea-ad5d-4c07-b9db-d4f446b4b22a	\N	2026-05-11 03:23:31.771+00	2026-05-11 03:23:58.445+00	75V41047F8665342J
09b992a7-fbb0-4483-af2f-a60f3c4f1af5	Building up my workforce	AI_MODEL_TRAINING	We will provide the hardware. Need an AI model for a mobile grass cutting unit that can identify different grass lengths and use a handheld trimmer. Bonus if the model can create hedge sculptures.	680	OPEN	America/Toronto	2026-05-11 03:36:00+00	2026-06-30 03:36:00+00	\N	10 Potter Crescent, Tottenham, ON L0G, Canada	44.0306686	-79.8092134	111	c0907ab1-9007-4944-afe6-45bb11b61341	\N	2026-05-11 03:41:05.092+00	2026-05-27 00:57:01.929+00	8KS21327HY246433W
d1a2625a-7d76-4aee-b594-cc8688b76c20	Secret Santa App	MOBILE_APP_DEVELOPMENT	I want a secret santa app. Make it, please.	1224	OPEN	America/New_York	2026-05-11 03:27:00+00	2026-07-04 03:27:00+00	\N	90 Mill Street, Essa, ON L0M, Canada	44.3176445	-79.8860367	124	2cc25c79-bdfd-4836-ae46-515f6ffa20d4	\N	2026-05-11 03:32:08.688+00	2026-05-27 00:58:11.976+00	02U814101P230120N
c5dc66b8-ce06-468f-b45c-842e0d3a5cb6	Clean up the parking lot	TRASH_CLEANUP	Looks horrible and I don't even own it. Just clean it up.	100	OPEN	America/Toronto	2026-05-11 03:24:00+00	2026-07-01 03:24:00+00	\N	652 Driftwood Road, Orillia, ON L3V, Canada	44.6035416	-79.3731364	125	2cc25c79-bdfd-4836-ae46-515f6ffa20d4	\N	2026-05-11 03:27:34.257+00	2026-05-27 00:58:41.101+00	92D57466UM711224M
a022139b-d908-4d30-b20b-328529969254	Water the plants	GARDEN_TENDING	Water once per day, make sure they don't wilt while I'm gone for a week.	111	OPEN	America/Toronto	2026-05-10 03:37:00+00	2026-08-17 03:37:00+00	\N	216 Cherry Court, Barrie, ON L4N 6A3, Canada	44.358145	-79.636719	79	2cc25c79-bdfd-4836-ae46-515f6ffa20d4	\N	2026-05-09 23:39:36.726+00	2026-05-27 00:59:01.543+00	0A3226397Y669433P
df6b2dcf-b808-4a9c-b1ce-51ae5b5fbf41	24/7 Tim Hortons model	AI_MODEL_TRAINING	Build a Tim Hortons employee model that integrates with a robotic arm.	6826	OPEN	America/Toronto	2026-06-09 19:43:00+00	2026-08-06 14:06:00+00	\N	Shell, 2098 Commerce Park Drive, Innisfil, ON L9S, Canada	44.2858575	-79.6726881	100	037af7ea-ad5d-4c07-b9db-d4f446b4b22a	\N	2026-06-09 19:48:55.63+00	2026-06-09 19:48:55.63+00	91W36602YW895591C
\.


--
-- Data for Name: Review; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Review" (id, rating, comment, "createdAt", "jobId", "authorId", "seekerId", "workerId") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, email, password, name, "paymentId", address, "userLat", "userLong", "createdAt", "seekerRating", "seekerReviewCount", "workerRating", "workerReviewCount") FROM stdin;
2cc25c79-bdfd-4836-ae46-515f6ffa20d4	softwaretester3413@gmail.com	asdfasdf	Software Tester	sb-aicpk30888135@personal.example.com	201 Fairview Road, Barrie, ON L4N, Canada	44.3521577	-79.6866899	2026-05-09 23:34:58.408+00	0	0	0	0
037af7ea-ad5d-4c07-b9db-d4f446b4b22a	jburt4@lakeheadu.ca	asdfasdf	Lake Head	sb-y2ae451024975@personal.example.com	201 Fairview Road, Barrie, ON L4N, Canada	44.3521577	-79.6866899	2026-05-09 23:40:31.43+00	0	0	0	0
c0907ab1-9007-4944-afe6-45bb11b61341	joshua.burt@ontariotechu.net	asdfasdf	Harry Potta	sb-s1eub51025120@personal.example.com	10 Potter Crescent, Tottenham, ON L0G, Canada	44.0306686	-79.8092134	2026-05-11 03:11:39.87+00	0	0	0	0
\.


--
-- Name: CompletedJob CompletedJob_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompletedJob"
    ADD CONSTRAINT "CompletedJob_pkey" PRIMARY KEY (id);


--
-- Name: Job Job_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_pkey" PRIMARY KEY (id);


--
-- Name: Review Review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: CompletedJob_paypalCaptureId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CompletedJob_paypalCaptureId_key" ON public."CompletedJob" USING btree ("paypalCaptureId");


--
-- Name: Job_paypalCaptureId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Job_paypalCaptureId_key" ON public."Job" USING btree ("paypalCaptureId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: CompletedJob CompletedJob_seekerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompletedJob"
    ADD CONSTRAINT "CompletedJob_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CompletedJob CompletedJob_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompletedJob"
    ADD CONSTRAINT "CompletedJob_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Job Job_seekerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Job Job_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Review Review_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Review Review_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."CompletedJob"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Review Review_seekerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Review Review_workerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict r2TZMTUF1TTFeKD8AaFhcBZ2rhfPDRozZangXRv5bOOSJD3JeDMhTktnmfCkfch

