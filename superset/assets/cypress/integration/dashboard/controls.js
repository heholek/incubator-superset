/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { WORLD_HEALTH_DASHBOARD } from './dashboard.helper';
import readResponseBlob from '../../utils/readResponseBlob';

export default () => describe('top-level controls', () => {
  const sliceRequests = [];
  const forceRefreshRequests = [];
  let mapId;

  beforeEach(() => {
    cy.server();
    cy.login();
    cy.visit(WORLD_HEALTH_DASHBOARD);

    cy.get('#app').then((data) => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
      const dashboard = bootstrapData.dashboard_data;
      mapId = dashboard.slices.find(slice => (slice.form_data.viz_type === 'world_map')).slice_id;

      dashboard.slices
        .forEach((slice) => {
          const sliceRequest = `getJson_${slice.slice_id}`;
          sliceRequests.push(`@${sliceRequest}`);
          const formData = `{"slice_id":${slice.slice_id}}`;
          cy.route('POST', `/superset/explore_json/?form_data=${formData}`).as(sliceRequest);

          const forceRefresh = `postJson_${slice.slice_id}_force`;
          forceRefreshRequests.push(`@${forceRefresh}`);
          cy.route('POST', `/superset/explore_json/?form_data={"slice_id":${slice.slice_id}}&force=true`).as(forceRefresh);
        });
    });
  });
  afterEach(() => {
    sliceRequests.length = 0;
    forceRefreshRequests.length = 0;
  });

  it.skip('should allow chart level refresh', () => {
    cy.wait(sliceRequests);
    cy.get('.grid-container .world_map').should('be.exist');
    cy.get(`#slice_${mapId}-controls`).click();
    cy.get(`#slice_${mapId}-controls`).next()
      .find('.refresh-tooltip').trigger('click', { force: true });

    // not allow dashboard level force refresh when any chart is loading
    cy.get('#save-dash-split-button').trigger('click', { force: true });
    cy.contains('Force refresh dashboard').parent().should('have.class', 'disabled');
    // not allow chart level force refresh when it is loading
    cy.get(`#slice_${mapId}-controls`).next()
      .find('.refresh-tooltip')
      .parent()
      .parent()
      .should('have.class', 'disabled');

    cy.wait(`@postJson_${mapId}_force`);
    cy.get('#save-dash-split-button').trigger('click');
    cy.contains('Force refresh dashboard').parent().not('have.class', 'disabled');
  });

  it.skip('should allow dashboard level force refresh', () => {
    // when charts are not start loading, for example, under a secondary tab,
    // should allow force refresh
    cy.get('#save-dash-split-button').trigger('click');
    cy.contains('Force refresh dashboard').parent().not('have.class', 'disabled');

    // wait the all dash finish loading.
    cy.wait(sliceRequests);
    cy.get('#save-dash-split-button').trigger('click');
    cy.contains('Force refresh dashboard').trigger('click', { force: true });
    cy.get('#save-dash-split-button').trigger('click');
    cy.contains('Force refresh dashboard').parent().should('have.class', 'disabled');

    // wait all charts force refreshed
    cy.wait(forceRefreshRequests).then((xhrs) => {
      // is_cached in response should be false
      xhrs.forEach((xhr) => {
        readResponseBlob(xhr.response.body).then((responseBody) => {
          expect(responseBody.is_cached).to.equal(false);
        });
      });
    });

    cy.get('#save-dash-split-button').trigger('click');
    cy.contains('Force refresh dashboard').parent().not('have.class', 'disabled');
  });
});
