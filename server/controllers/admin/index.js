import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import overview from './overview.js';
import users from './users.js';
import posts from './posts.js';
import channels from './channels.js';
import media from './media.js';
import events from './events.js';

const router = Router();
router.use(requireAdmin);
router.use('/overview', overview);
router.use('/users', users);
router.use('/posts', posts);
router.use('/channels', channels);
router.use('/media', media);
router.use('/events', events);
export default router;
