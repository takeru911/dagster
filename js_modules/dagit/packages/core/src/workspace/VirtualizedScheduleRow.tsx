import {gql, useLazyQuery} from '@apollo/client';
import {
  Box,
  Button,
  Caption,
  Colors,
  Icon,
  Menu,
  MiddleTruncate,
  Popover,
  Tooltip,
} from '@dagster-io/ui';
import * as React from 'react';
import {Link} from 'react-router-dom';
import styled from 'styled-components/macro';

import {useQueryRefreshAtInterval, FIFTEEN_SECONDS} from '../app/QueryRefresh';
import {InstigationStatus, InstigationType} from '../graphql/types';
import {LastRunSummary} from '../instance/LastRunSummary';
import {TickTag, TICK_TAG_FRAGMENT} from '../instigation/InstigationTick';
import {PipelineReference} from '../pipelines/PipelineReference';
import {RUN_TIME_FRAGMENT} from '../runs/RunUtils';
import {ScheduleSwitch, SCHEDULE_SWITCH_FRAGMENT} from '../schedules/ScheduleSwitch';
import {errorDisplay} from '../schedules/SchedulesTable';
import {TimestampDisplay} from '../schedules/TimestampDisplay';
import {humanCronString} from '../schedules/humanCronString';
import {MenuLink} from '../ui/MenuLink';
import {HeaderCell, Row, RowCell} from '../ui/VirtualizedTable';

import {LoadingOrNone, useDelayedRowQuery} from './VirtualizedWorkspaceTable';
import {isThisThingAJob, useRepository} from './WorkspaceContext';
import {RepoAddress} from './types';
import {
  SingleScheduleQuery,
  SingleScheduleQueryVariables,
} from './types/VirtualizedScheduleRow.types';
import {workspacePathFromAddress} from './workspacePath';

const TEMPLATE_COLUMNS = '76px 1fr 1fr 148px 210px 92px';

interface ScheduleRowProps {
  name: string;
  repoAddress: RepoAddress;
  height: number;
  start: number;
}

export const VirtualizedScheduleRow = (props: ScheduleRowProps) => {
  const {name, repoAddress, start, height} = props;

  const repo = useRepository(repoAddress);

  const [querySchedule, queryResult] = useLazyQuery<
    SingleScheduleQuery,
    SingleScheduleQueryVariables
  >(SINGLE_SCHEDULE_QUERY, {
    variables: {
      selector: {
        repositoryName: repoAddress.name,
        repositoryLocationName: repoAddress.location,
        scheduleName: name,
      },
    },
    notifyOnNetworkStatusChange: true,
  });

  useDelayedRowQuery(querySchedule);
  useQueryRefreshAtInterval(queryResult, FIFTEEN_SECONDS);

  const {data} = queryResult;

  const scheduleData = React.useMemo(() => {
    if (data?.scheduleOrError.__typename !== 'Schedule') {
      return null;
    }

    return data.scheduleOrError;
  }, [data]);

  const isJob = !!(scheduleData && isThisThingAJob(repo, scheduleData.pipelineName));

  const cronString = scheduleData
    ? humanCronString(scheduleData.cronSchedule, scheduleData.executionTimezone || 'UTC')
    : '';

  return (
    <Row $height={height} $start={start}>
      <RowGrid border={{side: 'bottom', width: 1, color: Colors.KeylineGray}}>
        <RowCell>
          {scheduleData ? (
            <Box flex={{direction: 'column', gap: 4}}>
              {/* Keyed so that a new switch is always rendered, otherwise it's reused and animates on/off */}
              <ScheduleSwitch key={name} repoAddress={repoAddress} schedule={scheduleData} />
              {errorDisplay(
                scheduleData.scheduleState.status,
                scheduleData.scheduleState.runningCount,
              )}
            </Box>
          ) : null}
        </RowCell>
        <RowCell>
          <Box flex={{direction: 'column', gap: 4}}>
            <span style={{fontWeight: 500}}>
              <Link to={workspacePathFromAddress(repoAddress, `/schedules/${name}`)}>
                <MiddleTruncate text={name} />
              </Link>
            </span>
            {scheduleData ? (
              <Caption>
                <PipelineReference
                  showIcon
                  size="small"
                  pipelineName={scheduleData.pipelineName}
                  pipelineHrefContext={repoAddress}
                  isJob={isJob}
                />
              </Caption>
            ) : null}
          </Box>
        </RowCell>
        <RowCell>
          {scheduleData ? (
            <Box flex={{direction: 'column', gap: 4}}>
              <ScheduleStringContainer style={{maxWidth: '100%'}}>
                <Tooltip position="top-left" content={scheduleData.cronSchedule} display="block">
                  <div
                    style={{
                      color: Colors.Dark,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                      textOverflow: 'ellipsis',
                    }}
                    title={cronString}
                  >
                    {cronString}
                  </div>
                </Tooltip>
              </ScheduleStringContainer>
              {scheduleData.scheduleState.nextTick &&
              scheduleData.scheduleState.status === InstigationStatus.RUNNING ? (
                <Caption>
                  <div
                    style={{
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Next tick:&nbsp;
                    <TimestampDisplay
                      timestamp={scheduleData.scheduleState.nextTick.timestamp!}
                      timezone={scheduleData.executionTimezone}
                      timeFormat={{showSeconds: false, showTimezone: true}}
                    />
                  </div>
                </Caption>
              ) : null}
            </Box>
          ) : (
            <LoadingOrNone queryResult={queryResult} />
          )}
        </RowCell>
        <RowCell>
          {scheduleData?.scheduleState.ticks.length ? (
            <div>
              <TickTag
                tick={scheduleData.scheduleState.ticks[0]}
                instigationType={InstigationType.SCHEDULE}
              />
            </div>
          ) : (
            <LoadingOrNone queryResult={queryResult} />
          )}
        </RowCell>
        <RowCell>
          {scheduleData?.scheduleState && scheduleData?.scheduleState.runs.length > 0 ? (
            <LastRunSummary
              run={scheduleData.scheduleState.runs[0]}
              name={name}
              showButton={false}
              showHover
              showSummary={false}
            />
          ) : (
            <LoadingOrNone queryResult={queryResult} />
          )}
        </RowCell>
        <RowCell>
          {scheduleData?.partitionSet ? (
            <Popover
              content={
                <Menu>
                  <MenuLink
                    text="View partition history"
                    icon="dynamic_feed"
                    target="_blank"
                    to={workspacePathFromAddress(
                      repoAddress,
                      `/${isJob ? 'jobs' : 'pipelines'}/${scheduleData.pipelineName}/partitions`,
                    )}
                  />
                  <MenuLink
                    text="Launch partition backfill"
                    icon="add_circle"
                    target="_blank"
                    to={workspacePathFromAddress(
                      repoAddress,
                      `/${isJob ? 'jobs' : 'pipelines'}/${scheduleData.pipelineName}/partitions`,
                    )}
                  />
                </Menu>
              }
              position="bottom-left"
            >
              <Button icon={<Icon name="expand_more" />} />
            </Popover>
          ) : (
            <span style={{color: Colors.Gray400}}>{'\u2013'}</span>
          )}
        </RowCell>
      </RowGrid>
    </Row>
  );
};

export const VirtualizedScheduleHeader = () => {
  return (
    <Box
      border={{side: 'horizontal', width: 1, color: Colors.KeylineGray}}
      style={{
        display: 'grid',
        gridTemplateColumns: TEMPLATE_COLUMNS,
        height: '32px',
        fontSize: '12px',
        color: Colors.Gray600,
      }}
    >
      <HeaderCell />
      <HeaderCell>Schedule name</HeaderCell>
      <HeaderCell>Schedule</HeaderCell>
      <HeaderCell>Last tick</HeaderCell>
      <HeaderCell>Last run</HeaderCell>
      <HeaderCell>Actions</HeaderCell>
    </Box>
  );
};

const RowGrid = styled(Box)`
  display: grid;
  grid-template-columns: ${TEMPLATE_COLUMNS};
  height: 100%;
`;

const ScheduleStringContainer = styled.div`
  max-width: 100%;

  .bp4-popover2-target {
    max-width: 100%;

    :focus {
      outline: none;
    }
  }
`;

const SINGLE_SCHEDULE_QUERY = gql`
  query SingleScheduleQuery($selector: ScheduleSelector!) {
    scheduleOrError(scheduleSelector: $selector) {
      ... on Schedule {
        id
        name
        pipelineName
        description
        scheduleState {
          id
          runningCount
          ticks(limit: 1) {
            id
            ...TickTagFragment
          }
          runs(limit: 1) {
            id
            ...RunTimeFragment
          }
          nextTick {
            timestamp
          }
        }
        partitionSet {
          id
          name
        }
        ...ScheduleSwitchFragment
      }
    }
  }

  ${TICK_TAG_FRAGMENT}
  ${RUN_TIME_FRAGMENT}
  ${SCHEDULE_SWITCH_FRAGMENT}
`;
