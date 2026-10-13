
    //<![CDATA[
    function _shortcodeiki(a, e, s) {
        if (Array.isArray(a)) {
            for (e = 0, s = Array(a.length); e < a.length; e++) s[e] = a[e];
            return s
        }
        return Array.from(a)
    }

function tShortcode(a, e, s) {
    return !!(a = [].concat(_shortcodeiki(a.matchAll(/(?:(#[a-zA-Z]{0,})=\(([^\)]+)\))/g))).find((function(a) {
        return a[1].split("#")[1] === e
    }))) && a[2]
}
$((function() {
    function a() {
        return '<span class="error-status"><b>Error:</b>&nbsp;' + tMessages.noResults + "</span>"
    }

    function e(a, e) {
        return a[e].link
    }

    function s(a, e) {
        return a[e].title
    }

    function t(a, e) {
        return a[e].thumbnail.src
    }

    function i(a, e) {
        return a[e].authorimage
    }

    function o(a, e) {
        return a[e].thumbnail.type
    }

    function n(a, e) {
        return a[e].date
    }

    function l(a, e) {
        return a[e].datetime
    }

    function r(a, e) {
        return a[e].author
    }

    function d(a, e) {
        return a[e].category
    }

    function p(a, e) {
        return a[e].summary
    }

    function h(a, e, s) {
        return s = a[e].author[0].gd$image.src.replace("/s220", "/w55-h55-p-k-no-nu"), blankImg = "/assets/vendor/05c0f2b996d4d16e53.jpg", s = s.replace("//img1.blogblog.com/img/blank.gif", blankImg).replace("//img1.blogblog.com/img/b16-rounded.gif", blankImg)
    }

    function m() {
        $(".search-section").each((function(a, e, s, t, i) {
            var o = $(this);
            s = "search", i = "/search/?q=" + (t = $(".search-form .search-input").val().trim()) + "&max-results=6";
            "" != t && t != localStorage.search_id && (localStorage.search_id = t, b(o, "4", "search", s, t, i))
        }))
    }

    function f() {
        $(".post-body a").each((function(a, e, s, t) {
            var i = $(this);
            "post" == tShortcode((t = i.text()).toLowerCase().trim(), "type") && (i.removeAttr("href"), t = 0 != (t = tShortcode(t, "title")) ? t : "You Might Like", $(window).on("load resize scroll", (function a() {
                $(window).scrollTop() + $(window).height() >= i.offset().top && ($(window).off("load resize scroll", a), g(i, "1", "random", "card", t))
            })).trigger("scroll"))
        }))
    }

    function u() {
        $(".inpost-ad").each((function() {
            var a = $("#ads-top").text();
            $(this).html('<div class="widget">' + a + "</div>")
        }))
    }

    function g(e, s, t, i, o) {
        "block1" != i && "block2" != i && "block3" != i && "video" != i && "grid1" != i || (t.match("recent", "random") ? e.parent().find(".widget-title").append('<a class="more-c" href="/search">' + tMessages.showMore + "</a>") : e.parent().find(".widget-title").append('<a class="more-c" href="/search/label/' + t + '">' + tMessages.showMore + "</a>")), "trending" == i || "featured" == i || "block1" == i || "block2" == i || "block3" == i || "video" == i || "grid1" == i || "related" == i || "card" == i || "sidebar" == i || "comments" == i ? b(e, s, t, i, o) : e.html(a())
    }

    function v(a, e, s, t) {
        return e.match("recent") ? t = "/search/?amp=1&max-results=" + a : e.match("random") ? t = "/search/?amp=1&q=%7C&max-results=" + a : e.match("search") ? t = "/search/?q=" + s + "&by-date=true&max-results=4&amp=1" : e.match("show") ? t = "/feeds/comments/default?alt=json&max-results=" + a : e.match("random") && e.match("recent") && e.match("search") || (t = "/search/label/" + e + "?amp=1&max-results=" + a), t
    }

    function b(c, m, f, u, g, b) {
        $.ajax({
            type: "GET",
            url: v(m, f, g),
            cache: !0,
            dataType: "comments" == u ? "json" : "html",
            beforeSend: function(a) {
                switch (u) {
                    case "megamenu":
                        c.append('<div class="my-menu"><div class="loading-icon"/></div>').addClass("loaded"), c.addClass("mega-menu");
                        break;
                    case "trending":
                        c.html('<div class="loading-icon"/>').parent().find(".widget-content").addClass("open-iki");
                        break;
                    case "search":
                    case "featured":
                    case "block1":
                    case "block2":
                    case "block3":
                    case "grid1":
                    case "video":
                    case "sidebar":
                    case "comments":
                    case "related":
                    case "card":
                        c.html('<div class="loading-icon"/>').parent().addClass("type-" + u + " open-iki")
                }
            },
            success: function(m) {
                var f = "";
                switch (u) {
                    case "megamenu":
                        f += '<div class="my-menu"><div class="mega-boxs">';
                        break;
                    case "trending":
                        f += '<div class="breaking-ticker">';
                        break;
                    case "search":
                        f += '<div class="my-ajax">';
                        break;
                    case "featured":
                        f += '<div class="featured-grid-all">';
                        break;
                    case "block1":
                        f += '<div class="raw-main-wrapper">';
                        break;
                    case "block2":
                        f += '<div class="block-wrapper">';
                        break;
                    case "block3":
                        f += '<div class="square-wrapper">';
                        break;
                    case "video":
                        f += '<div class="video-wrapper">';
                        break;
                    case "grid1":
                        f += '<div class="my-grid">';
                        break;
                    case "sidebar":
                        f += '<div class="my-sidebar">';
                        break;
                    case "comments":
                        f += '<div class="comment-list">';
                        break;
                    case "related":
                        f += '<div class="my-related">';
                        break;
                    case "card":
                        f += '<div class="post-wrap">';
                        break;
                    default:
                        f += "<ul>"
                }
                var v = "comments" == u ? m.feed.entry : JSON.parse($(m).find("#native-feed").text()).feed.entry;
                if (null != v) {
                    for (var k = 0; k < v.length; k++) {
                        if ("comments" === u) var w = h(v, k),
                            y = v[k].link[2].href,
                            x = v[k].author[0].name.$t,
                            M = v[k].title.$t ? v[k].title.$t : tMessages.noTitle;
                        else {
                            y = e(v, k), M = s(v, k);
                            var C = n(v, k),
                                A = l(v, k),
                                T = (x = r(v, k), w = i(v, k), d(v, k)),
                                S = t(v, k),
                                I = o(v, k),
                                L = p(v, k)
                        }
                        var z = "";
                        switch (u) {
                            case "megamenu":
                                f += '<div class="mega-box"><div class="Mega-img-ui"><div class="post-filter-link ' + I + '"><a class="megamenu-thumb" href="' + y + '"><img class="snip-thumbnail lazy-img" alt="' + M + '" data-src="' + S + '"/></a></div></div><div class="featured-meta"><h2 class="entry-title"><a href="' + y + '">' + M + '</a></h2><div class="post-snip"><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></div></div></div>";
                                break;
                            case "trending":
                                f += '<div class="tickerNews item' + k + '"><a class="post-filter-inner ' + I + '" href="' + y + '"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></a><div class="entery-category-box"><span class="post-tag">' + T + '</span><h2 class="entry-title"><a href="' + y + '">' + M + '</a></h2><div class="post-snip"><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></div></div></div>";
                                break;
                            case "search":
                                f += '<div class="search-box"><div class="search-thumb"><a class="post-filter-link" href="' + y + '"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></a></div><div class="entery-category-box"><h2 class="entry-title"><a href="' + y + '">' + M + '</a></h2><div class="post-snip"><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></div></div></div>";
                                break;
                            case "featured":
                                f += 0 === k ? '<div class="featured-box item' + k + '"><a class="post-filter-inner gaint ' + I + '" href="' + y + '"><span class="post-filter-link background-layer "><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></span><span class="entery-category-fly"><span class="post-tag">' + T + '</span><h2 class="entry-title">' + M + '</h2><div class="post-snip">' + tMessages.postAuthorLabel + '<span class="post-author">' + x + '</span><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></span></div></span></a></div>" : (1 === k ? '<div class="featured-block">' : "") + '<div class="featured-box item' + k + '"><a class="post-filter-inner" href="' + y + '"><span class="post-filter-link background-layer ' + I + '"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></span></a><div class="entery-category-fly"><span class="post-tag">' + T + '</span><h2 class="entry-title">' + M + '</h2><div class="post-snip">' + tMessages.postAuthorLabel + '<span class="post-author">' + x + '</span><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></div></div></div>";
                                break;
                            case "block1":
                                f += '<div class="block-step item' + k + '"><div class="block-thumb"><a class="post-filter-link ' + I + '" href="' + y + '"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></a></div><div class="entery-category-box"><span class="post-tag">' + T + '</span><h2 class="entry-title"><a href="' + y + '">' + M + '</a></h2><div class="post-snip">' + tMessages.postAuthorLabel + '<span class="post-author">' + x + '</span><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></div></div></div>";
                                break;
                            case "block2":
                                f += 0 === k ? '<div class="block-module item' + k + '"><a class="post-filter-link ' + I + '" href="' + y + '"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></a><div class="entery-category"><span class="post-tag">' + T + '</span><h2 class="entry-title"><a href="' + y + '" title="' + M + '">' + M + '</a></h2><div class="post-snip">' + tMessages.postAuthorLabel + '<span class="post-author">' + x + '</span><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></div></div></div>" : (1 === k ? '<div class="block-combo">' : "") + '<div class="block-module item' + k + '"><div class="entery-category"><span class="post-tag">' + T + '</span><h2 class="entry-title"><a href="' + y + '" title="' + M + '">' + M + '</a></h2><div class="post-snip"><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + '</span></div></div><a class="post-filter-link ' + I + '" href="' + y + '"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></a></div>';
                                break;
                            case "block3":
                                f += 0 === k ? '<div class="square-posts item' + k + '"><a class="post-filter-link ' + I + '" href="' + y + '"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></a><div class="entery-category"><span class="post-tag">' + T + '</span><h2 class="entry-title"><a href="' + y + '" title="' + M + '">' + M + '</a></h2><p class="post-snippet">' + L + '</p><div class="post-snip">' + tMessages.postAuthorLabel + '<span class="post-author">' + x + '</span><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + '</span></div><a aria-label="' + M + '" class="read-more" href="' + y + '">Xem chi tiết!</a></div></div>' : (1 === k ? '<div class="square-combo">' : "") + '<div class="square-posts item' + k + '"><a class="post-filter-link ' + I + '" href="' + y + '"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></a><div class="entery-category"><span class="post-tag">' + T + '</span><h2 class="entry-title"><a href="' + y + '" title="' + M + '">' + M + '</a></h2><div class="post-snip">' + tMessages.postAuthorLabel + '<span class="post-author">' + x + '</span><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></div></div></div>";
                                break;
                            case "video":
                                f += 0 === k ? '<div class="video-module item' + k + '"><a class="post-filter-inner" href="' + y + '"><span class="post-filter-link background-layer video-nos"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></span><div class="entery-category-fly"><span class="post-tag">' + T + '</span><h2 class="entry-title">' + M + '</h2><div class="post-snip">' + tMessages.postAuthorLabel + '<span class="post-author">' + x + '</span><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></div></div></a></div>" : (1 === k ? '<div class="video-box">' : "") + '<div class="video-module item' + k + '"><a class="post-filter-inner" href="' + y + '"><span class="post-filter-link background-layer video-nos"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></span><div class="entery-category-fly"><span class="post-tag">' + T + '</span><h2 class="entry-title">' + M + '</h2><div class="post-snip">' + tMessages.postAuthorLabel + '<span class="post-author">' + x + '</span><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></div></div></a></div>";
                                break;
                            case "grid1":
                                f += 0 === k ? '<div class="modal-grid item' + k + '"><a class="post-filter-inner ' + I + '" href="' + y + '"><span class="post-filter-link  background-layer"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></span><span class="entery-category-fly"><span class="post-tag">' + T + '</span><h2 class="entry-title">' + M + '</h2><div class="post-snip">' + tMessages.postAuthorLabel + '<span class="post-author">' + x + '</span><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></span></div></span></a></div>" : (1 === k ? '<div class="modal-box">' : "") + '<div class="modal-grid item' + k + '"><a class="post-filter-inner" href="' + y + '"><span class="post-filter-link ' + I + '"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></span></a><div class="entery-category"><span class="post-tag">' + T + '</span><h2 class="entry-title"><a href="' + y + '" title="' + M + '">' + M + '</a></h2><div class="post-snip"><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></div></div></div>";
                                break;
                            case "comments":
                                f += '<div class="comments-box"><a class="engine-link" href="' + y + '"><span class="comment-image"><img class="snip-thumbnail" data-src="' + w + '"/></span><div class="comment-hero"><h2 class="entry-title cmm-title">' + x + '</h2><p class="comment-snippet">' + M + "</p></div></a></div>";
                                break;
                            case "sidebar":
                                f += '<div class="sidebarui-posts"><div class="glax-img"><a class="post-filter-link ' + I + '" href="' + y + '"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></a></div><div class="entery-category-box"><span class="post-tag">' + T + '</span><h2 class="entry-title"><a href="' + y + '">' + M + '</a></h2><div class="post-snip"><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></div></div></div>";
                                break;
                            case "related":
                                f += '<div class="related-box"><div class="related-box-thumb"><a class="post-filter-link ' + I + '" href="' + y + '"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></a></div><div class="entery-category"><h2 class="entry-title"><a href="' + y + '">' + M + '</a></h2><div class="post-snip"><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></div></div></div>";
                                break;
                            case "card":
                                f += '<div class="post-card"><div class="post-image"><a class="post-filter-link" href="' + y + '"><img class="snip-thumbnail" alt="' + M + '" data-src="' + S + '"/></a></div><div class="entery-category-box"><div class="card-healine">' + g + '</div><h2 class="entry-title"><a href="' + y + '">' + M + '</a></h2><div class="post-snip">' + tMessages.postAuthorLabel + '<span class="post-author">' + x + '</span><span class="' + tMessages.dateIco + '" datetime="' + A + '">' + C + "</span></div></div></div>";
                                break;
                            default:
                                c.html('<div class="loading-icon"/>').parent().addClass("open-iki"), f += a(), c.parent().html(f)
                        }
                    }
                    f += z += "</ul>"
                } else if ("megamenu" === u) f = '<div class="my-menu">' + a() + "</div>";
                else f = a();
                switch (u) {
                    case "megamenu":
                        f += "</div></div>", c.addClass(u).find(".my-menu").replaceWith(f);
                        break;
                    case "trending || featured || block1 || block2 || block3 || video || grid1 || sidebar || comments || related || card":
                        c.html(f), f += "</div></div>";
                        break;
                    case "search":
                        c.html(f), f += "</div>", k > 0 && c.append('<div class="link-snip"><a href="' + b + '">' + tMessages.showMore + "</a></div>");
                        break;
                    default:
                        f += "</div>", c.html(f)
                }
                if ("megamenu" === u) c.find("img.snip-thumbnail").lazyimg({
                    onScroll: !1
                });
                else c.find("img.snip-thumbnail").lazyimg()
            },
            error: function() {
                if ("megamenu" === u) c.append('<div class="my-menu">' + a() + "</div>");
                else c.html(a())
            }
        })
    }

    function k() {
        $("#feed-view, #sidebar-container").each((function() {
            1 == tMessages.fixedSidebar && $(this).theiaStickySidebar({
                containerSelector: "#center-container > .container",
                additionalMarginTop: 30,
                additionalMarginBottom: 30
            })
        }))
    }
    $(".original-menu li").each((function(e, s) {
        var t = $(this);
        if ((i = t.find("a").attr("href")).match("megamenu")) {
            var i;
            if (2 === (i = i.split("/")).length) s = i[0], e = i[1];
            c = "recent" == e || "random" == e ? "/search" : "/search/label/" + e, t.children("a").attr("href", c), t.addClass("sub-has"), t.mouseenter((function() {
                t.hasClass("loaded") || ("megamenu" == s ? b(t, 5, e, s) : t.append('<div class="my-menu">' + a() + "</div>").addClass("loaded"))
            }))
        }
    })), $(".ticker-pro .HTML .widget-content").each((function(a, e, s) {
        var t, i = $(this);
        if (2 === (t = (t = i.text().trim()).split("/")).length) {
            s = t[0], e = t[1];
            if ("trending" === s) a = 4;
            $(window).on("load resize scroll", (function t() {
                $(window).scrollTop() + $(window).height() >= i.offset().top && ($(window).off("load resize scroll", t), g(i, a, e, s))
            })).trigger("scroll")
        }
    })), $("#search-flex").each((function() {
        $(".search-flex-close").on("click", (function() {
            m()
        })), $(window).on("keydown", (function(a) {
            13 == a.keyCode && m()
        }))
    })), f(), $(".Pro-flex .HTML .widget-content").each((function(a, e, s) {
        var t, i = $(this);
        if (2 === (t = (t = i.text().trim()).split("/")).length) {
            s = t[0], e = t[1];
            if ("featured" === s) a = 3;
            $(window).on("load resize scroll", (function t() {
                $(window).scrollTop() + $(window).height() >= i.offset().top && ($(window).off("load resize scroll", t), g(i, a, e, s))
            })).trigger("scroll")
        }
    })), $(".Pro-box .HTML .widget-content").each((function(a, e, s) {
        var t, i = $(this);
        if (2 === (t = (t = i.text().trim()).split("/")).length) {
            s = t[0], e = t[1];
            switch (s) {
                case "block1":
                case "video":
                    a = 4;
                    break;
                case "block2":
                case "block3":
                    a = 5;
                    break;
                case "grid1":
                    a = 7
            }
            $(window).on("load resize scroll", (function t() {
                $(window).scrollTop() + $(window).height() >= i.offset().top && ($(window).off("load resize scroll", t), g(i, a, e, s))
            })).trigger("scroll")
        }
    })), $(".Pro-box .HTML .widget-content").each((function(a, e, s) {
        var t = $(this),
            i = t.text();
        if (i.match("block3")) {
            var o = i.split("/");
            if (!isNaN(o[0])) {
                a = o[0], s = o[1], e = o[2];
                $(window).on("load resize scroll", (function i() {
                    $(window).scrollTop() + $(window).height() >= t.offset().top && ($(window).off("load resize scroll", i), g(t, a, e, s))
                })).trigger("scroll")
            }
        }
    })), $(".sidebar .HTML .widget-content").each((function(a, e, s) {
        var t = $(this),
            i = t.text();
        if (i.match("sidebar") || i.match("comments")) {
            var o = i.split("/");
            if (!isNaN(o[0])) {
                a = o[0], s = o[1], e = o[2];
                $(window).on("load resize scroll", (function i() {
                    $(window).scrollTop() + $(window).height() >= t.offset().top && ($(window).off("load resize scroll", i), g(t, a, e, s))
                })).trigger("scroll")
            }
        }
    })), $(".ProPosts-related").each((function(a, e, s) {
        var t = $(this),
            i = $(".related-posts .HTML"),
            o = i.text(),
            n = $(".related-tag").text(),
            c = o.split("/");
        if (!isNaN(c[0])) {
            a = c[0], s = c[1], e = o.match("default") ? n : c[2];
            $(window).on("load resize scroll", (function o() {
                $(window).scrollTop() + $(window).height() >= t.offset().top && ($(window).off("load resize scroll", o), g(t, a, e, s)), i.parent().remove()
            })).trigger("scroll")
        }
    }));
    var w = new Date;
    w.setDate(w.getDate()), $(".date-format").html("Hôm nay | " + w.getDate() + " " + ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"][w.getMonth()] + " Năm " + w.getFullYear()), $(".dark-toggle-flex").click((function() {
            localStorage.setItem("mode", "darkmode" === localStorage.getItem("mode") ? "mydark" : "darkmode"), $("#mainContent").addClass("dark"), $("#darkroom, #darkroom1, #darkroom2").each((function() {
                var a = $(this);
                "darkmode" === localStorage.getItem("mode") ? a.attr("src", a.attr("data-dark")) : ($("#mainContent").removeClass("dark"), a.attr("src", a.attr("data-normal")))
            }))
        })), $("img.snip-thumbnail").lazyimg(), $("#original-menu").Menuiki(), $(".menu li").each((function() {
            0 < $(this).find("ul").length && $(this).addClass("drop-down")
        })), $("#mobile-menu").each((function() {
            var a = $(this);
            $("#original-menuList").clone().appendTo(a), $(".hamburger, .hide-mobile-menu").on("click", (function() {
                $("body").toggleClass("spring-open")
            }))
        })), $(".mobile-menu ul .mega-menu").removeClass("sub-tab"), $(".mobile-menu ul li a").on("click", (function() {
            $(this).parent().removeClass("show").find("> .m-sub").slideToggle(170)
        })), $(".social-mobile").each((function() {
            var a = $(this);
            $(".footer-primary ul.colorful-ico").clone().appendTo(a)
        })), $(".search-button-flex").on("click", (function() {
            localStorage.search_id = "", $("#search-flex").fadeIn(200).find("input").focus(), $("body").addClass("active-search")
        })), $(".overlay, #overlay-id").on("click", (function() {
            $("body").removeClass("active-search spring-open")
        })), $("#header-wrapper .hamburger-container").each((function() {
            var a = $(this);
            if (1 == tMessages.fixedMenu && 0 < a.length) {
                var e = $(document).scrollTop(),
                    s = a.offset().top,
                    t = a.height(),
                    i = s + t + 50;
                $(window).scroll((function() {
                    var o = $(document).scrollTop();
                    o < $("#footer-wrapper").offset().top - t && (o > i ? a.addClass("fixed-nos") : o < s && a.removeClass("fixed-nos"), o > e ? a.removeClass("show") : a.addClass("show"), e = $(document).scrollTop())
                }))
            }
        })),

        $("#load-more-link").each((function() {
            var a = $(this).data("load");
            a && $("#load-more-link").show(),
                $("#load-more-link").on("click", (function(e) {
                    $("#load-more-link").hide(),
                        $.ajax({
                            url: a,
                            success: function(e) {
                                var s = $(e).find(".grid-posts");
                                s.find(".post-filter").addClass("loading-frame load-time"),
                                    $(".grid-posts").append(s.html()),
                                    $(document).ready(function() {
                                        hideArticle();
                                    });
                                (a = $(e).find("#load-more-link").data("load")) ? $("#load-more-link").show(): ($("#load-more-link").hide(),

                                    $("#blog-pager .no-more").addClass("show"))
                            },
                            beforeSend: function() {
                                $("#blog-pager .loading").show()
                            },
                            complete: function() {
                                $("#blog-pager .loading").hide(), $(".grid-posts .hentry .snip-thumbnail").not(".lazy-img").lazyimg(), k()
                            }
                        }), e.preventDefault()
                }))
        })), k(), $(".post-body blockquote").each((function() {
            var a = $(this),
                e = a.text().toLowerCase().trim(),
                s = a.html();
            if (e.match("(alert-success)")) {
                const e = s.replace("(alert-success)", "");
                a.replaceWith('<div class="alert-message success">' + e + "</div>")
            }
            if (e.match("(alert-passed)")) {
                const e = s.replace("(alert-passed)", "");
                a.replaceWith('<div class="alert-message passed">' + e + "</div>")
            }
            if (e.match("(alert-warning)")) {
                const e = s.replace("(alert-warning)", "");
                a.replaceWith('<div class="alert-message warning">' + e + "</div>")
            }
            if (e.match("(alert-error)")) {
                const e = s.replace("(alert-error)", "");
                a.replaceWith('<div class="alert-message error">' + e + "</div>")
            }
            if (e.match("(code-box)")) {
                const e = s.replace("(code-box)", "");
                newTemp = e.replace(/"/g, "'"), a.replaceWith('<pre class="code-box">' + e + '<input id="showlink" readonly="readonly" type="text" value=" ' + newTemp + ' "/></pre>')
            }
        })), $(".copy-post").on("click", (function() {
            $(".copy-post").addClass("copied"), $(".code-box, .copy-post").find("#showlink").select(), document.execCommand("copy"), setTimeout((function() {
                $(".copy-post").removeClass("copied")
            }), 5e3)
        })), $(".post-body a").each((function() {
            var a = $(this),
                e = a.text(),
                s = tShortcode(e, "text");
            if (e.match("getButton") && s && (a.replaceText(/([^{\(]+(?=\)))/, ""), a.each((function() {
                    var a = $(this),
                        e = a.text(),
                        s = tShortcode(e, "text"),
                        t = tShortcode(e, "icon"),
                        i = tShortcode(e, "color"),
                        o = tShortcode(e, "size");
                    a.addClass(o ? "main-button button l-bt" : "main-button button").text(s), 0 != t && a.addClass(t), 0 != i && a.attr("style", "background:" + i + ";")
                }))), e.match("getCard")) {
                var t = tShortcode(e, "type");
                e = tShortcode(e, "title");
                var i = a.attr("href"),
                    o = a.attr("target");
                switch (t) {
                    case "download":
                    case "product":
                    case "custom":
                        a.replaceText(/([^{\(]+(?=\)))/, ""), a.each((function() {
                            var a = $(this),
                                e = a.text(),
                                s = tShortcode(e, "button"),
                                n = tShortcode(e, "icon"),
                                c = tShortcode(e, "title"),
                                l = tShortcode(e, "info");
                            l = l ? '<span class="card-data">' + l + "</span>" : "", a.replaceWith('<div class="card-wrap"><div class="card-header"><div class="card-icon"><i class="bi" data-icon="' + (n || ("download" == t ? "&#xF30A;" : "product" == t ? "&#xF23A;" : "&#xF26C;")) + '"></i></div><div class="card-info"><span class="card-title">' + (c || tMessages.noTitle) + "</span>" + l + '</div></div><a class="card-button main-button" href="' + (i || "#") + '" target="' + (o || "_self") + '">' + s + "</a></div>")
                        }))
                }
            }
        })), $(".post-body strike").each((function() {
            var a = $(this),
                e = a.text(),
                s = e.toLowerCase().trim();
            if (a.text(e.replace("(showAds)", "").replace("(hideAds)", "")), s.match("(toc)") && (e = 0 != (e = tShortcode(e, "title")) ? e : "Table of Contents", a.replaceWith('<div class="tociki-pro"><div class="tociki-inner"><a href="javascript:;" class="tociki-title" role="button" title="Table of Contents"><span class="tociki-title-text">' + e + '</span></a><ol id="tociki"></ol></div></div>'), $(".tociki-title").each((function(a) {
                    (a = $(this)).on("click", (function() {
                        a.toggleClass("opened"), $("#tociki").slideToggle(180)
                    }))
                })), $("#tociki").toc({
                    content: ".post-body",
                    headings: "h2,h3,h4"
                }), $("#tociki li a").each((function(a) {
                    (a = $(this)).click((function() {
                        return $("html,body").animate({
                            scrollTop: $(a.attr("href")).offset().top
                        }, 500), !1
                    }))
                }))), e.trim().match("(nextPage)") && a.replaceWith("\x3c!-- nextpage --\x3e"), ("(ads)" === e.trim() || "(ads1)" === e.trim() || "(ads2)" === e.trim()) && a.replaceWith('<div class="inpost-ad"/>'), htmlorder = a.html(), s.match("(contact-form)") && (a.replaceWith('<div class="contact-form"/>'), $(".contact-form").append($("#ContactForm1"))), s.match("(caps)")) {
                const e = htmlorder.replace("(caps)", "");
                a.replaceWith('<span class="firstword">' + e + "</span>")
            }
            if (s.match("(left-sidebar)")) {
                htmlorder.replace("(left-sidebar)", "");
                a.replaceWith("<style>.flex-section .outer-container{flex-direction:row-reverse;}</style>")
            }
            if (s.match("(right-sidebar)")) {
                htmlorder.replace("(right-sidebar)", "");
                a.replaceWith("<style>.flex-section .outer-container{flex-direction:initial;}</style>")
            }
            if (s.match("(full-width)")) {
                htmlorder.replace("(full-width)", "");
                a.replaceWith("<style>.item-view #feed-view{width:100%}.item-view #sidebar-container{display:none}</style>")
            }
        })), $(".item-post").each((function() {
            var a = $(this),
                e = a.find(".post-body"),
                s = a.find(".pagination"),
                t = e.html().split(/\x3c!-- nextpage --\x3e/i),
                i = t.length;
            1 < i && (tata = function() {
                var a = window.location.href,
                    o = a.match(/[?]/g) ? "&" : "?";
                komu = new URL(a.replace("#", o)), manu = komu.searchParams.get("page"), index = Number(0 > manu ? 1 : manu || 1) - 1, e.html(t[index]);
                var n = index + 1;
                s.html((1 < n ? '<a href="#page=' + (n - 1) + '" class="prev btn">Previous</a>' : "") + '<span class="info"> Page ' + n + " of " + i + "</span>" + (n < i ? '<a href="#page=' + (n + 1) + '" class="next btn">Next</a>' : "")), s.find(".btn").on("click", (function() {
                    $("html, body").animate({
                        scrollTop: 0
                    }, 500)
                })), f(), u()
            }, $(window).on("hashchange", tata), tata())
        })), u(), $(".top-ads").each((function() {
            var a = $("#main-ads-post").text();
            $(this).html('<div class="widget">' + a + "</div>")
        })), $(".below-ads").each((function() {
            var a = $("#main-ads-post").text();
            $(this).html('<div class="widget">' + a + "</div>")
        })), $("#post-placeholder").each((function() {
            var a = $("#main-ads-post").text();
            $(this).html('<div class="widget">' + a + "</div>")
        })), $(".share-runs .window-t, .share-wrapper-icons .window-t").on("click", (function() {
            var a = $(this),
                e = a.data("url"),
                s = a.data("width");
            a = a.data("height"), window.open(e, "_blank", "scrollbars=yes,resizable=yes,toolbar=no,location=yes,width=" + s + ",height=" + a + ",left=" + Math.round(window.screen.width / 2 - s / 2) + ",top=" + Math.round(window.screen.height / 2 - a / 2)).focus()
        })), $(".show-hid a, .share-top, .close-check, .share-it").on("click", (function() {
            $("body").toggleClass("show-share")
        })), $(".sidebar").each((function(a, e) {
            var s = $(this),
                t = s.find(".sibForm .widget-content").data("shortcode");
            t && (a = tShortcode(t, "title"), e = tShortcode(t, "caption"), 0 != a && s.find(".follow-by-email-title").html(a), 0 != e && s.find(".follow-by-email-caption").html(e))
        })), $(".author-description a").each((function() {
            $(this).attr("target", "_blank")
        })), $(".about-author .author-description span a, .profile-info .profile-textblock a").each((function() {
            var a = $(this),
                e = a.text().trim(),
                s = a.attr("href");
            a.replaceWith('<li class="' + e + '"><a class="bi-' + e + '" href="' + s + '" title="' + e + '" target="_blank"/></li>'), $(".profile-info .description-links").append($(".profile-info .profile-textblock li")), $(".about-author .description-links").append($(".author-description span li")), $(".description-links").addClass("show")
        })), $(".primary-nav").each((function() {
            var a = $("a.prev-post-link").attr("href"),
                e = $("a.next-post-link").attr("href");
            $(window).one("scroll", (function() {
                $(window).one("scroll", (function() {
                    $.ajax({
                        url: a,
                        type: "get",
                        success: function(a) {
                            a = $(a).find(".hentry h1.entry-title").text(), $(".post-prev a .navigation-posts p").text(a)
                        }
                    }), $.ajax({
                        url: e,
                        type: "get",
                        success: function(a) {
                            a = $(a).find(".hentry h1.entry-title").text(), $(".post-next a .navigation-posts p").text(a)
                        }
                    })
                }))
            }))
        })), $(".comments-section").each((function() {
            var a = $(this),
                e = a.data("shortcode"),
                s = tShortcode(e, "type"),
                t = '<div class="fb-comments" data-width="100%" data-href="' + $(location).attr("href") + '" data-numposts="5"></div>',
                i = "comments-system-" + s,
                o = tShortcode(e, "shortname");
            "blogger" == s ? $(this).addClass(i).show() : "disqus" == s ? ((s = document.createElement("script")).type = "text/javascript", s.async = !0, s.src = "//" + o + ".disqus.com/embed.js", (document.getElementsByTagName("head")[0] || document.getElementsByTagName("body")[0]).appendChild(s), $("#comments").remove(), $(this).append('<div id="disqus_thread"/>').addClass(i).show()) : "facebook" == s ? (e = 0 != (e = tShortcode(e, "lang")) ? "https://connect.facebook.net/" + e + "/all.js#xfbml=1&version=v14.0" : "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v14.0", $("head").append('<script async="async" defer="defer" crossorigin="anonymous" src="' + e + '" />'), $("#comments").remove(), $(this).append(t).addClass(i).show()) : "hide" == s ? $(this).hide() : $(this).addClass("comments-system-default").show(), $(".avatar-image-container img").each((function() {
                var a = this.src;
                $(this).removeAttr("src").attr("src", a.replace("//resources.blogblog.com/img/blank.gif", "/assets/vendor/04f6cbb8e8001ce31c.png"))
            }));
            var n = $(this).find(".comments .toplevel-thread > ol > .comment .comment-actions .comment-reply"),
                c = $(this).find(".comments .toplevel-thread > #top-continue");
            n.on("click", (function() {
                c.show(), $(".comment-replybox-thread").hide()
            })), c.on("click", (function() {
                c.hide(), $(".comment-replybox-thread").show()
            }));
            var l = a.find(".comments .comment-reply"),
                r = a.find(".comments #top-continue"),
                d = a.find("#show-comment-form");
            l.on("click", (function() {
                r.show(), a.addClass("comment-section-visible"), d.remove()
            })), r.on("click", (function() {
                r.hide()
            })), d.on("click", (function() {
                a.addClass("comment-section-visible"), d.remove(), k()
            }))
        })), $("p.comment-content").each((function() {
            var a = $(this);
            $(window).one("scroll", (function() {
                a.replaceText(/(https:\/\/\S+(\.png|\.jpeg|\.jpg|\.gif))/g, '<img src="$1"/>'), a.replaceText(/(?:https:\/\/)?(?:www\.)?(?:youtube\.com)\/(?:watch\?v=)?(.+)/g, '<div class="video-frame"><iframe id="youtube" width="100%" height="360" src="https://www.youtube.com/embed/$1" frameborder="0" allow="autoplay; accelerometer; gyroscope; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>')
            }))
        }))
})), $("#cookies-iki").each((function() {
    var a = $(this),
        e = a.find(".widget.HTML").text(),
        s = a.find(".cookies-bt");
    a.length > 0 && (e && (buttons = tShortcode(e, "buttons"), days = tShortcode(e, "days"), 0 != buttons && s.text(buttons), days = 0 != days ? Number(days) : 7), "1" !== $.cookie("cookiesgmag") && (a.css("display", "block"), setTimeout((function() {
        a.addClass("cookies-show")
    }), 10)), $(".cookies-bt").off("click").on("click", (function(e) {
        e.preventDefault(), e.stopPropagation(), $.cookie("cookiesgmag", "1", {
            expires: days,
            path: "/"
        }), a.removeClass("cookies-show"), setTimeout((function() {
            a.css("display", "none")
        }), 500)
    })), cookieChoices = {})
})), $(".backTop").each((function() {
    var a = $(this);
    $(window).on("scroll", (function() {
        100 <= $(this).scrollTop() ? a.fadeIn(250) : a.fadeOut(250)
    })), a.click((function() {
        $("html, body").animate({
            scrollTop: 0
        }, 500)
    }))
}));

//]]>
