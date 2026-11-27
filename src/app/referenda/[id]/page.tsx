import type { Metadata } from "next";
import { enrichReferendumVotes, liveGovernancePost, liveReferendum, liveReferendumVotes, liveTracks } from "@/lib/subscan-data";
import { ensureDiscussionTarget } from "@/lib/discussion-server";
import { referendumDiscussionPath } from "@/lib/discussion";
import { activeNetwork } from "@/lib/network-server";
import { liveGovernanceBlockSeconds } from "@/lib/governance-clock-server";
import { notFound, redirect } from "next/navigation";
import { ReferendumView } from "./view";
import { DataNotice } from "@/components/data-notice";
import { PageHeader } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import type { ChainId } from "@/lib/types";
import { lastVotesPage, requestedVotesPage } from "@/lib/referendum-votes";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Referendum #${id}` };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chain?: string; votes?: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const query = await searchParams;
  const network = await activeNetwork(query.chain);
  const index = Number(id);
  const requestedPage = requestedVotesPage(query.votes);

  const [loaded, firstVotes, tracks, governancePost, secondsPerBlock] = await Promise.all([
    liveReferendum(index, network).catch(() => "failed" as const),
    liveReferendumVotes(index, network, { page: 0 }).catch(() => null),
    liveTracks(network).catch(() => []),
    liveGovernancePost(index, network).catch(() => undefined),
    liveGovernanceBlockSeconds(network),
  ]);

  // A failed request is not a missing referendum: say so instead of rendering a 404.
  if (loaded === "failed") return <ReferendumUnavailable id={index} network={network} />;
  const referendum = loaded;
  if (referendum?.id == null) notFound();

  const lastPage = firstVotes ? lastVotesPage(firstVotes.count, firstVotes.row) : 0;
  if (requestedPage === null || (firstVotes && requestedPage > lastPage)) {
    redirect(withChain(`/referenda/${id}/`, network, lastPage > 0 && requestedPage !== null ? { votes: lastPage + 1 } : undefined));
  }
  const votesPage = requestedPage;
  const voteData = votesPage === 0 || !firstVotes
    ? firstVotes
    : await liveReferendumVotes(index, network, { page: votesPage }).catch(() => null);
  if (voteData && votesPage > lastVotesPage(voteData.count, voteData.row)) {
    const latestLastPage = lastVotesPage(voteData.count, voteData.row);
    redirect(withChain(`/referenda/${id}/`, network, latestLastPage > 0 ? { votes: latestLastPage + 1 } : undefined));
  }

  const track = tracks.find((t) => t.id === referendum.trackId);
  const discussionPath = referendumDiscussionPath(network, referendum.id);
  const [votes, discussion] = await Promise.all([
    enrichReferendumVotes(index, network, voteData?.votes ?? referendum.votes ?? []),
    ensureDiscussionTarget(discussionPath)
      .then((target) => ({ target, error: undefined }))
      .catch((error: unknown) => ({
        target: null,
        error: error instanceof DOMException && error.name === "TimeoutError"
          ? "Discussion service timed out"
          : error instanceof Error ? error.message : "Discussion is unavailable",
      })),
  ]);
  return (
    <ReferendumView
      key={`${network}:${index}`}
      referendum={{ ...referendum, votes }}
      track={track}
      voteCount={voteData?.count}
      votesPage={votesPage}
      votesPageSize={voteData?.row}
      votesFailed={voteData === null}
      secondsPerBlock={secondsPerBlock}
      governancePost={governancePost}
      discussionTarget={discussion.target}
      discussionError={discussion.error}
    />
  );
}

function ReferendumUnavailable({ id, network }: { id: number; network: ChainId }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: withChain("/referenda/", network), label: "Referenda" }} kicker={`Referendum #${id}`} title={`Referendum #${id}`} />
      <DataNotice kind="error" title="Data unavailable">
        Subscan did not return this referendum right now. It may still exist — reload the page in a moment, or open it from the list.
      </DataNotice>
    </div>
  );
}
