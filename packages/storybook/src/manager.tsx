import React from 'react';
import { addons, types } from 'storybook/manager-api';

import { ADDON_ID, PANEL_ID } from './constants.js';
import { Panel } from './Panel.js';

addons.register(ADDON_ID, () => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'Token Graph',
    match: ({ viewMode }) => viewMode === 'story',
    render: () => <Panel />,
  });
});
