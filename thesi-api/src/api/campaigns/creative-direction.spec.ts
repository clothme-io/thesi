import {
  emptyCreativeDirection,
  normalizeCreativeDirection,
} from './creative-direction';

describe('campaign creative direction', () => {
  it('keeps a campaign valid when audience and video direction are omitted', () => {
    expect(normalizeCreativeDirection(undefined)).toEqual(
      emptyCreativeDirection(),
    );
    expect(normalizeCreativeDirection({})).toEqual(emptyCreativeDirection());
  });

  it('keeps every selected age, life stage, work, shopper style, and video style', () => {
    expect(
      normalizeCreativeDirection({
        audience: {
          ageRanges: ['18-24', '35-44', 'nope'],
          genders: ['women', 'men'],
          lifeStages: ['parent', 'student'],
          workRoles: ['office', 'healthcare'],
          shopperStyles: ['budget', 'premium'],
          note: '  Work outfits  ',
        },
        video: {
          styles: ['talking_head', 'green_screen', 'talking_head'],
          face: 'on_camera',
          settings: ['at_home', 'outdoors'],
          length: '15_30s',
          mustInclude: ['Show the fit', 'Show the fit'],
          avoid: ['Heavy filters'],
        },
      }),
    ).toEqual({
      audience: {
        ageRanges: ['18-24', '35-44'],
        genders: ['women', 'men'],
        lifeStages: ['parent', 'student'],
        workRoles: ['office', 'healthcare'],
        shopperStyles: ['budget', 'premium'],
        note: 'Work outfits',
      },
      video: {
        styles: ['talking_head', 'green_screen'],
        face: 'on_camera',
        settings: ['at_home', 'outdoors'],
        length: '15_30s',
        mustInclude: ['Show the fit'],
        avoid: ['Heavy filters'],
      },
    });
  });
});
